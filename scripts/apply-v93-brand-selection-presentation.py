from pathlib import Path
import json

OLD = "brand-selection-transaction-v92-20260811-2109"
NEW = "brand-selection-presentation-v93-20260811-2124"
OLD_TIME = "Aug 11, 2026 9:09 PM ET"
NEW_TIME = "Aug 11, 2026 9:24 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


# 1. Add a presentation-only boundary to the workspace action service. Brand
# selection must redraw committed state without re-entering the full render
# preparation pipeline, which is allowed to normalize workspace selections.
path = "app/controllers/workspace-action-service.js"
text = read(path)
anchor = '''  function activeWorkspaceTab() {'''
insert = '''  function presentCurrentState() {
    const coordinator = global.LabelerRenderingCoordinator;
    if (typeof coordinator?.driver?.present === "function" && typeof coordinator?.handlers === "function") {
      return coordinator.driver.present(coordinator.handlers());
    }

    // Compatibility fallback for startup/test environments where the rendering
    // coordinator has not been installed yet. This is intentionally presentation
    // only: do not call global render(), because render() runs normalization.
    [
      "renderMap",
      "renderStations",
      "renderBottleSpecs",
      "renderLabelSpecs",
      "renderBuildInputs",
      "renderProgram",
      "renderSimulation",
      "renderHeads",
      "renderValidation",
      "renderTopControls"
    ].forEach((name) => call(name));
    return null;
  }

'''
if anchor not in text:
    raise SystemExit("workspace action insertion anchor missing")
text = text.replace(anchor, insert + anchor, 1)
old_export = '''    execute,
    render: renderTargets,
    call,
    number'''
new_export = '''    execute,
    render: renderTargets,
    present: presentCurrentState,
    call,
    number'''
if old_export not in text:
    raise SystemExit("workspace action export anchor missing")
text = text.replace(old_export, new_export, 1)
write(path, text)


# 2. Replace the v92 Brand flow. The selected recipe is now committed,
# regenerated, persisted, then presented without a full render/normalization
# cycle. A deferred verification re-presents the exact committed state so the
# native selects and Validation/Program views cannot remain visually stale.
path = "app/controllers/build-inputs-controller.js"
text = read(path)
start = text.find("  let brandSelectionSequence = 0;")
end = text.find("\n\n  function selectBottle", start)
if start < 0 or end < 0:
    raise SystemExit("brand selection block anchors missing")
replacement = '''  let brandSelectionSequence = 0;

  function selectBrand(value) {
    const requested = String(value ?? "");
    const available = actions.call("labelSpecsForApplication") || state.labelSpecs || [];
    const selected = available.find((row) => String(row?.brand ?? "") === requested);
    if (!selected) return false;
    const requestedBrand = String(selected.brand);
    const transaction = ++brandSelectionSequence;

    const applyRequestedSelection = () => {
      state.selectedBrand = requestedBrand;
      actions.call("ensureBottleReferenceForLabel", selected);
      actions.call("applyLabelLengthStationRules");
      global.LabelerLabelCenterlinePolicy?.ensureApplicationReferenceDefaults?.(state);
    };

    const restoreBuildInputs = () => {
      global.LabelerTabsController?.setDirectTabState?.(
        "buildInputs",
        global.document?.querySelector?.('.tabs .tab[data-tab="buildInputs"]') || null
      );
    };

    const presentRequestedSelection = ({ regenerate = false, persist = false } = {}) => {
      applyRequestedSelection();
      if (regenerate) actions.call("applyGeneratedServoProfile");
      applyRequestedSelection();
      if (persist) actions.call("saveCurrentSettings");
      actions.present?.();
      restoreBuildInputs();
    };

    return actions.execute({
      mutate() {
        applyRequestedSelection();
      },
      regenerate: true,
      persist: true,
      render: null,
      restoreTab: "buildInputs",
      after() {
        if (transaction !== brandSelectionSequence) return;

        // The generated profile was built from the requested recipe above.
        // Reassert the recipe before presentation so a compatibility wrapper
        // cannot leave the visible controls on the previous Brand/Bottle.
        presentRequestedSelection({ persist: true });

        const settle = () => {
          if (transaction !== brandSelectionSequence) return;
          const selectionChanged = String(state.selectedBrand ?? "") !== requestedBrand;
          if (selectionChanged) {
            // A late compatibility task changed the recipe. Rebuild from the
            // requested Brand before repainting, rather than displaying a mix
            // of the old Servo Program and the new select value.
            presentRequestedSelection({ regenerate: true, persist: true });
            return;
          }
          // Always repaint once after the native select settles. v92 restored
          // state here but skipped this repaint when state already matched,
          // leaving the old Brand/Bottle visible in Build Inputs.
          actions.present?.();
          restoreBuildInputs();
        };

        if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(settle);
        else if (typeof global.setTimeout === "function") global.setTimeout(settle, 0);
      }
    });
  }'''
text = text[:start] + replacement + text[end:]
write(path, text)


# 3. Update the focused regeneration contract: Brand changes no longer call
# full render(). They regenerate and use the presentation boundary in after().
path = "tests/brand-selection-regeneration.test.js"
text = read(path)
text = text.replace(
    'assert.strictEqual(execution?.render, "all", "Selecting a brand must rerender the workspace after regeneration.");',
    'assert.strictEqual(execution?.render, null, "Selecting a brand must not enter the full normalization render cycle.");\nassert.equal(typeof execution?.after, "function", "Selecting a brand must present the committed recipe after regeneration.");'
)
if 'execution?.render, null' not in text:
    raise SystemExit("brand selection regeneration test update failed")
write(path, text)


# 4. Replace the synthetic v92 test with a presentation-level regression that
# catches the exact user-visible failure: if global render() is entered it
# deliberately paints Land Shark. v93 must never call it during Brand change,
# and both initial + deferred presentation must show Bud Light Lime / LNNR.
old_test = Path("tests/brand-selection-transaction-v92.test.js")
if old_test.exists():
    old_test.unlink()
write("tests/brand-selection-presentation-v93.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const actionSource = fs.readFileSync(path.join(root, "app/controllers/workspace-action-service.js"), "utf8");
const buildSource = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
let raf = null;
let saves = 0;
let renderCalls = 0;
let generatedBrand = "";
let visibleBrand = "";
let visibleBottle = "";
let presentations = 0;
const buttons = { specs: { dataset: { tab: "specs" } }, buildInputs: { dataset: { tab: "buildInputs" } } };
const sandbox = {
  window: null,
  globalThis: null,
  state: {
    activeTab: "buildInputs",
    selectedBrand: "12oz Land Shark (LN)",
    selectedBottle: "SSNR - 12 Oz",
    labelSpecs: [
      { brand: "12oz Land Shark (LN)", applicationMode: "apl", bottleType: "SSNR - 12 Oz" },
      { brand: "12oz Bud Light Lime (9F)", applicationMode: "apl", bottleType: "LNNR - 12 Oz" }
    ],
    bottleSpecs: [{ bottleType: "SSNR - 12 Oz" }, { bottleType: "LNNR - 12 Oz" }],
    buildInputs: {}
  },
  document: {
    querySelector(selector) {
      if (selector === ".tabs .tab.active[data-tab]") return buttons[sandbox.state.activeTab] || null;
      if (selector.includes('data-tab="buildInputs"')) return buttons.buildInputs;
      if (selector.includes('data-tab="specs"')) return buttons.specs;
      return null;
    }
  },
  LabelerTabsController: {
    setDirectTabState(name) { sandbox.state.activeTab = name; return true; }
  },
  LabelerRenderingCoordinator: {
    driver: {
      present(handlers) {
        presentations += 1;
        handlers.renderBuildInputs();
        handlers.renderProgram();
        handlers.renderValidation();
        return ["renderBuildInputs", "renderProgram", "renderValidation"];
      }
    },
    handlers() {
      return {
        renderBuildInputs() {
          visibleBrand = sandbox.state.selectedBrand;
          visibleBottle = sandbox.state.selectedBottle;
        },
        renderProgram() {},
        renderValidation() {}
      };
    }
  },
  labelSpecsForApplication() { return sandbox.state.labelSpecs; },
  selectedLabelSpec() { return sandbox.state.labelSpecs.find((row) => row.brand === sandbox.state.selectedBrand); },
  ensureBottleReferenceForLabel(spec) { if (spec?.bottleType) sandbox.state.selectedBottle = spec.bottleType; },
  applyLabelLengthStationRules() {},
  applyGeneratedServoProfile() { generatedBrand = sandbox.state.selectedBrand; },
  saveCurrentSettings() { saves += 1; },
  render() {
    renderCalls += 1;
    sandbox.state.selectedBrand = "12oz Land Shark (LN)";
    sandbox.state.selectedBottle = "SSNR - 12 Oz";
    visibleBrand = sandbox.state.selectedBrand;
    visibleBottle = sandbox.state.selectedBottle;
    sandbox.state.activeTab = "specs";
  },
  requestAnimationFrame(callback) { raf = callback; return 1; },
  setTimeout(callback) { callback(); return 1; },
  console, Number, String, Boolean, Object
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(actionSource, sandbox, { filename: "workspace-action-service.js" });
vm.runInContext(buildSource, sandbox, { filename: "build-inputs-controller.js" });

const result = sandbox.LabelerBuildInputsController.selectBrand("12oz Bud Light Lime (9F)");
assert.notStrictEqual(result, false);
assert.equal(renderCalls, 0, "Brand selection must not enter full render normalization.");
assert.equal(sandbox.state.selectedBrand, "12oz Bud Light Lime (9F)");
assert.equal(sandbox.state.selectedBottle, "LNNR - 12 Oz");
assert.equal(generatedBrand, "12oz Bud Light Lime (9F)", "Servo Program must regenerate from the requested Brand.");
assert.equal(visibleBrand, "12oz Bud Light Lime (9F)", "Build Inputs must immediately present the requested Brand.");
assert.equal(visibleBottle, "LNNR - 12 Oz", "Build Inputs must immediately present the requested bottle association.");
assert.equal(sandbox.state.activeTab, "buildInputs");
assert.ok(saves >= 2, "The committed recipe must be persisted after generation and presentation.");
assert.ok(presentations >= 1);
assert.equal(typeof raf, "function");
raf();
assert.equal(renderCalls, 0);
assert.equal(visibleBrand, "12oz Bud Light Lime (9F)");
assert.equal(visibleBottle, "LNNR - 12 Oz");
assert.equal(sandbox.state.activeTab, "buildInputs");
assert.ok(presentations >= 2, "Deferred native-select settlement must repaint committed state.");
console.log("Brand selection presentation v93 behavioral regression passed.");
''')


# 5. Replace v92 delivery test with v93 assertions.
old_delivery = Path("tests/workspace-selection-delivery-v92.test.js")
if old_delivery.exists():
    old_delivery.unlink()
write("tests/workspace-selection-delivery-v93.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const BUILD = "brand-selection-presentation-v93-20260811-2124";
const actions = fs.readFileSync(path.join(root, "app/controllers/workspace-action-service.js"), "utf8");
assert.match(actions, /function presentCurrentState\(/);
assert.match(actions, /coordinator\.driver\.present\(coordinator\.handlers\(\)\)/);
assert.doesNotMatch(actions.match(/function presentCurrentState\([\s\S]*?\n  \}/)?.[0] || "", /call\("render"\)/);
const build = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
assert.match(build, /render:\s*null/);
assert.match(build, /actions\.present\?\.\(\)/);
assert.match(build, /presentRequestedSelection/);
assert.match(build, /restoreTab:\s*"buildInputs"/);
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
for (const source of [bootstrap, sw, updater, app, index]) assert.match(source, new RegExp(BUILD));
assert.equal(manifest.buildId, BUILD);
console.log("Brand selection presentation and delivery v93 regression passed.");
''')


# 6. Publish v93 through every client-visible build identity. Keep v92 in the
# bootstrap lineage but make v93 the active build.
path = "app/bootstrap.js"
text = read(path)
old_const = f'  const build = "{OLD}";'
new_const = f'  const build = "{NEW}";'
if old_const not in text:
    raise SystemExit("bootstrap current build id missing")
text = text.replace(old_const, new_const, 1)
text = text.replace(f'  const buildUpdatedAt = "{OLD_TIME}";', f'  const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
write(path, text)

for path in ["app.js", "index.html", "service-worker.js", "app/update-manager.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"current v92 build id missing from {path}")
    text = text.replace(OLD, NEW)
    text = text.replace(OLD_TIME, NEW_TIME)
    write(path, text)

# Existing functional regressions that intentionally pin the active delivery
# build are moved forward; their geometry/behavior assertions are untouched.
for path in ["tests/bottle-orientation-panel.test.js", "tests/entry-exit-dead-zone-overlay.test.js"]:
    text = read(path)
    if OLD in text:
        text = text.replace(OLD, NEW)
        write(path, text)

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v93 fixes the remaining Build Inputs Brand-selection display/runtime race. Brand changes no longer enter the full render preparation pipeline; the requested recipe is committed, its Servo Program is regenerated, settings are persisted, and the rendering coordinator runs presentation stages only. Build Inputs, Bottle Type, Validation, Servo Program, map, and related views are repainted from the committed recipe again after the native select settles. v92 navigation ownership, Top View, wipe-direction, APL geometry, and validator semantics remain unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
