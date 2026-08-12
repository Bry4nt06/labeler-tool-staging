from pathlib import Path
import json

OLD = "workspace-selection-delivery-v91-20260811-2033"
NEW = "brand-selection-transaction-v92-20260811-2109"
OLD_TIME = "Aug 11, 2026 8:33 PM ET"
NEW_TIME = "Aug 11, 2026 9:09 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


setup_bindings = '''"use strict";

// Workspace tab navigation is owned by app/controllers/tabs-controller.js,
// which is loaded directly by index.html before the bootstrap pipeline. This
// compatibility module intentionally attaches no browser listeners. Keeping a
// second window-capture navigation layer here caused native Build Inputs
// controls to race the authoritative tab controller during full rerenders.
(function publishSetupBindingsCompatibility(global) {
  function activate(tabName, tabElement = null) {
    const tabs = global.LabelerTabsController;
    if (typeof tabs?.setDirectTabState !== "function") return false;
    return tabs.setDirectTabState(
      String(tabName || ""),
      tabElement || global.document?.querySelector?.(`.tabs .tab[data-tab="${String(tabName || "")}"]`) || null
    );
  }

  global.ServoForgeEarlyWorkspaceNavigation = Object.freeze({
    installed: true,
    version: 2,
    build: "brand-selection-transaction-v92-20260811-2109",
    activate,
    bootstrapIndependent: true,
    delegatedToTabsController: true,
    coordinateRecovery: false
  });

  global.LabelerSetupBindingsCompatibility = Object.freeze({
    stateOwner: "LabelerSetupStateController",
    eventOwner: "LabelerSetupEventControllers",
    mapOwner: "LabelerMapController",
    settingsOwner: "LabelerSettingsController",
    workspaceNavigationOwner: "LabelerTabsController"
  });
})(window);
'''
write("app/setup-bindings.js", setup_bindings)

path = "app/controllers/workspace-action-service.js"
text = read(path)
old = '  function execute(options = {}) {\n    const tabBefore = options.preserveTab === false ? "" : activeWorkspaceTab();'
new = '  function execute(options = {}) {\n    const tabBefore = options.preserveTab === false\n      ? ""\n      : typeof options.restoreTab === "string" && options.restoreTab\n        ? options.restoreTab\n        : activeWorkspaceTab();'
if old not in text:
    raise SystemExit("workspace-action-service execute anchor not found")
write(path, text.replace(old, new, 1))

path = "app/controllers/build-inputs-controller.js"
text = read(path)
old = '''  function selectBrand(value) {
    const requested = String(value ?? "");
    const available = actions.call("labelSpecsForApplication") || state.labelSpecs || [];
    const selected = available.find((row) => String(row?.brand ?? "") === requested);
    if (!selected) return false;
    const requestedBrand = String(selected.brand);

    return actions.execute({
      mutate() {
        state.selectedBrand = requestedBrand;
        actions.call("ensureBottleReferenceForLabel", selected);
        actions.call("applyLabelLengthStationRules");
        global.LabelerLabelCenterlinePolicy?.ensureApplicationReferenceDefaults?.(state);
      },
      regenerate: true,
      persist: false,
      render: "all",
      beforeRender() {
        if (String(state.selectedBrand ?? "") !== requestedBrand) {
          state.selectedBrand = requestedBrand;
          actions.call("ensureBottleReferenceForLabel", selected);
          actions.call("applyLabelLengthStationRules");
          global.LabelerLabelCenterlinePolicy?.ensureApplicationReferenceDefaults?.(state);
          actions.call("applyGeneratedServoProfile");
          state.selectedBrand = requestedBrand;
          actions.call("ensureBottleReferenceForLabel", selected);
        }
        actions.call("saveCurrentSettings");
      }
    });
  }
'''
new = '''  let brandSelectionSequence = 0;

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

    return actions.execute({
      mutate() {
        applyRequestedSelection();
      },
      regenerate: true,
      persist: true,
      render: "all",
      restoreTab: "buildInputs",
      beforeRender() {
        if (String(state.selectedBrand ?? "") !== requestedBrand) {
          applyRequestedSelection();
          actions.call("applyGeneratedServoProfile");
          applyRequestedSelection();
        }
      },
      after() {
        if (transaction !== brandSelectionSequence) return;
        applyRequestedSelection();
        restoreBuildInputs();

        const settle = () => {
          if (transaction !== brandSelectionSequence) return;
          const selectionChanged = String(state.selectedBrand ?? "") !== requestedBrand;
          const activeTab = String(state.activeTab || "");
          if (selectionChanged) applyRequestedSelection();
          if (selectionChanged && typeof global.renderBuildInputs === "function") global.renderBuildInputs();
          if (selectionChanged || activeTab !== "buildInputs") restoreBuildInputs();
          if (selectionChanged || activeTab !== "buildInputs") actions.call("saveCurrentSettings");
        };

        if (typeof global.requestAnimationFrame === "function") global.requestAnimationFrame(settle);
        else if (typeof global.setTimeout === "function") global.setTimeout(settle, 0);
      }
    });
  }
'''
if old not in text:
    raise SystemExit("build-inputs selectBrand anchor not found")
write(path, text.replace(old, new, 1))

path = "app/controllers/setup-event-controller-integration.js"
text = read(path)
old = '    else if (target.id === "brandSelect") build.selectBrand(target.value);'
new = '''    else if (target.id === "brandSelect") {
      const requestedBrand = target.value;
      tabs.setDirectTabState?.("buildInputs", document.querySelector('.tabs .tab[data-tab="buildInputs"]'));
      const accepted = build.selectBrand(requestedBrand);
      if (accepted === false) target.value = state.selectedBrand;
    }'''
if old not in text:
    raise SystemExit("setup-event brandSelect anchor not found")
write(path, text.replace(old, new, 1))

path = "app/bootstrap.js"
text = read(path)
old = '''      const expected = new URL(`./${path}`, window.location.href).pathname;
      const existing = [...document.scripts].find((script) => {
        try { return new URL(script.src, window.location.href).pathname === expected;
        } catch { return false; }
      });'''
new = '''      const expected = new URL(`./${path}?v=${encodeURIComponent(version)}&build=${encodeURIComponent(build)}`, window.location.href).href;
      const existing = [...document.scripts].find((script) => script.src === expected);'''
if old not in text:
    raise SystemExit("bootstrap loader anchor not found")
write(path, text.replace(old, new, 1))

path = "service-worker.js"
text = read(path)
old = '''function normalizedRequest(source) {
  const url = new URL(typeof source === "string" ? source : source.url, self.registration.scope);
  url.search = "";
  url.hash = "";
  return new Request(url.href, { method: "GET" });
}'''
new = '''function normalizedRequest(source) {
  const url = new URL(typeof source === "string" ? source : source.url, self.registration.scope);
  const buildTagged = url.searchParams.has("build");
  if (!buildTagged) url.search = "";
  url.hash = "";
  return new Request(url.href, { method: "GET" });
}'''
if old not in text:
    raise SystemExit("service-worker normalizedRequest anchor not found")
write(path, text.replace(old, new, 1))

for file in ["app/bootstrap.js", "app.js", "index.html", "service-worker.js", "app/update-manager.js"]:
    text = read(file)
    if OLD not in text:
        raise SystemExit(f"old build id missing from {file}")
    text = text.replace(OLD, NEW).replace(OLD_TIME, NEW_TIME)
    write(file, text)

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v92 fixes the Build Inputs Brand selection race. The obsolete v69 window-capture navigation shim is retired so the statically loaded Tabs controller is the sole workspace navigation owner; Brand changes now execute as an explicit Build Inputs transaction that survives regeneration, full render, and the deferred UI pass. Bootstrap controller loading and service-worker build caching are also build-aware. Existing Top View, wipe-direction, APL geometry, and Servo Program semantics are unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

old_test = Path("tests/workspace-selection-delivery-v91.test.js")
if old_test.exists():
    old_test.unlink()
write("tests/workspace-selection-delivery-v92.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const BUILD = "brand-selection-transaction-v92-20260811-2109";
const persistence = fs.readFileSync(path.join(root, "app/persistence.js"), "utf8");
assert.match(persistence, /"wipeBuilderOpen", "activeTab", "activeMapId"/);
assert.match(persistence, /activeTab:\s*state\.activeTab/);
const actions = fs.readFileSync(path.join(root, "app/controllers/workspace-action-service.js"), "utf8");
assert.match(actions, /typeof options\.restoreTab === "string"/);
assert.match(actions, /restoreWorkspaceTab\(tabBefore\)/);
const build = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
assert.match(build, /restoreTab:\s*"buildInputs"/);
assert.match(build, /brandSelectionSequence/);
assert.match(build, /requestAnimationFrame/);
const setup = fs.readFileSync(path.join(root, "app/setup-bindings.js"), "utf8");
assert.doesNotMatch(setup, /addEventListener\s*\(/);
assert.match(setup, /workspaceNavigationOwner:\s*"LabelerTabsController"/);
const delegated = fs.readFileSync(path.join(root, "app/controllers/setup-event-controller-integration.js"), "utf8");
assert.match(delegated, /target\.id === "brandSelect"/);
assert.match(delegated, /setDirectTabState\?\.\("buildInputs"/);
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
assert.match(bootstrap, /script\.src === expected/);
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
assert.match(sw, /url\.searchParams\.has\("build"\)/);
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
for (const source of [bootstrap, sw, updater, app, index]) assert.match(source, new RegExp(BUILD));
assert.equal(manifest.buildId, BUILD);
console.log("Brand selection transaction and delivery v92 regression passed.");
''')

write("tests/brand-selection-transaction-v92.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const actionSource = fs.readFileSync(path.join(root, "app/controllers/workspace-action-service.js"), "utf8");
const buildSource = fs.readFileSync(path.join(root, "app/controllers/build-inputs-controller.js"), "utf8");
let raf = null;
let saves = 0;
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
  labelSpecsForApplication() { return sandbox.state.labelSpecs; },
  selectedLabelSpec() { return sandbox.state.labelSpecs.find((row) => row.brand === sandbox.state.selectedBrand); },
  ensureBottleReferenceForLabel(spec) { if (spec?.bottleType) sandbox.state.selectedBottle = spec.bottleType; },
  applyLabelLengthStationRules() {},
  applyGeneratedServoProfile() { sandbox.state.selectedBrand = "12oz Land Shark (LN)"; },
  saveCurrentSettings() { saves += 1; },
  render() { sandbox.state.activeTab = "specs"; },
  renderBuildInputs() {},
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
assert.equal(sandbox.state.selectedBrand, "12oz Bud Light Lime (9F)");
assert.equal(sandbox.state.selectedBottle, "LNNR - 12 Oz");
assert.equal(sandbox.state.activeTab, "buildInputs");
assert.ok(saves >= 1);
assert.equal(typeof raf, "function");
raf();
assert.equal(sandbox.state.selectedBrand, "12oz Bud Light Lime (9F)");
assert.equal(sandbox.state.activeTab, "buildInputs");
console.log("Brand selection transaction v92 behavioral regression passed.");
''')

write("tests/top-navigation-recovery.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const tabs = fs.readFileSync(path.join(root, "app/controllers/tabs-controller.js"), "utf8");
const setup = fs.readFileSync(path.join(root, "app/setup-bindings.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.doesNotThrow(() => new vm.Script(tabs));
assert.match(tabs, /navigationCaptureV3:\s*true/);
assert.match(tabs, /setDirectTabState/);
assert.match(tabs, /stopImmediatePropagation/);
assert.doesNotMatch(setup, /addEventListener\s*\(/, "setup-bindings must not compete with TabsController");
assert.match(setup, /workspaceNavigationOwner:\s*"LabelerTabsController"/);
assert.doesNotMatch(bootstrap, /"app\/controllers\/tabs-controller\.js"/);
const navIndex = index.indexOf("app/controllers/tabs-controller.js");
const setupIndex = index.indexOf("app/setup-bindings.js");
const bootstrapIndex = index.indexOf("app/bootstrap.js");
assert.ok(navIndex >= 0 && navIndex < setupIndex && setupIndex < bootstrapIndex);
console.log("Authoritative top navigation recovery regression passed.");
''')
