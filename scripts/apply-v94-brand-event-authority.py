from pathlib import Path
import json

OLD = "brand-selection-presentation-v93-20260811-2124"
NEW = "brand-selection-event-authority-v94-20260811-2150"
OLD_TIME = "Aug 11, 2026 9:24 PM ET"
NEW_TIME = "Aug 11, 2026 9:50 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


# 1. Specification/sensor guidance must never own Build Inputs Brand changes or
# workspace navigation. It remains a diagnostic/highlight service. Spec # was
# retired in v64 and cannot remain a hidden required-field gate.
path = "app/controllers/specification-sensor-guidance-controller.js"
text = read(path)
obsolete_spec_requirement = '    if (!String(spec?.specNumber || "").trim()) addIssue(issues, "label", index, "specNumber", rowName, "Spec # is required.");\n'
if obsolete_spec_requirement not in text:
    raise SystemExit("obsolete Spec # requirement not found")
text = text.replace(obsolete_spec_requirement, "", 1)

blocking = '''  document.addEventListener("click", (event) => {
    const tab = event.target.closest?.(".tab[data-tab]");
    const source = runtimeState();
    if (!tab || tab.dataset.tab === "specs" || source?.activeTab !== "specs") return;
    if (validateAndPrompt()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  document.addEventListener("change", (event) => {
    const brandSelect = event.target.closest?.("#brandSelect");
    if (!brandSelect) return;
    const issues = validateSpecifications();
    if (!issues.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    brandSelect.value = String(runtimeState()?.selectedBrand || "");
    showRequiredDialog(issues);
  }, true);

'''
replacement = '''  // v94 ownership boundary: specification guidance is advisory. Workspace tab
  // navigation is owned by LabelerTabsController, and #brandSelect changes are
  // owned exclusively by LabelerSetupEventControllers/BuildInputsController.
  // Guidance may highlight/report specification issues, but it must never
  // prevent navigation, rewrite a Brand select value, or consume that event.

'''
if blocking not in text:
    raise SystemExit("blocking guidance listeners not found")
text = text.replace(blocking, replacement, 1)

export_anchor = '''  global.LabelerSpecificationSensorGuidanceController = Object.freeze({
    installed: true,
    validateSpecifications,'''
export_replacement = '''  global.LabelerSpecificationSensorGuidanceController = Object.freeze({
    installed: true,
    advisoryOnlyV94: true,
    brandSelectionOwnedByBuildInputsV94: true,
    workspaceNavigationOwnedByTabsV94: true,
    retiredSpecNumberRequirementV94: true,
    validateSpecifications,'''
if export_anchor not in text:
    raise SystemExit("guidance export anchor not found")
text = text.replace(export_anchor, export_replacement, 1)
write(path, text)


# 2. Publish explicit authority on the setup event boundary.
path = "app/controllers/setup-event-controller-integration.js"
text = read(path)
anchor = '''  global.LabelerSetupEventControllers = Object.freeze({
    installed: true,
    settings,'''
replacement = '''  global.LabelerSetupEventControllers = Object.freeze({
    installed: true,
    brandSelectionAuthorityV94: true,
    settings,'''
if anchor not in text:
    raise SystemExit("setup event export anchor not found")
text = text.replace(anchor, replacement, 1)
write(path, text)


# 3. Add a regression that inventories the real DOM event owners. This catches
# the exact production failure: an earlier capture listener consuming or
# rewriting #brandSelect before the Build Inputs controller sees target.value.
write("tests/brand-selection-event-authority-v94.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

const guidance = fs.readFileSync(path.join(root, "app/controllers/specification-sensor-guidance-controller.js"), "utf8");
const setup = fs.readFileSync(path.join(root, "app/controllers/setup-event-controller-integration.js"), "utf8");
const coldGlue = fs.readFileSync(path.join(root, "app/cold-glue-label-geometry-fallback-integration.js"), "utf8");

assert.match(guidance, /advisoryOnlyV94:\s*true/);
assert.match(guidance, /brandSelectionOwnedByBuildInputsV94:\s*true/);
assert.match(guidance, /workspaceNavigationOwnedByTabsV94:\s*true/);
assert.match(guidance, /retiredSpecNumberRequirementV94:\s*true/);
assert.doesNotMatch(guidance, /brandSelect\.value\s*=/, "Guidance must never rewrite the Brand dropdown.");
assert.doesNotMatch(guidance, /event\.target\.closest\?\.\("#brandSelect"\)/, "Guidance must not listen for Brand selection changes.");
assert.doesNotMatch(guidance, /Spec # is required\./, "Retired Spec # must not remain a required-field gate.");

assert.match(setup, /target\.id === "brandSelect"/);
assert.match(setup, /const requestedBrand = target\.value/);
assert.match(setup, /build\.selectBrand\(requestedBrand\)/);
assert.match(setup, /brandSelectionAuthorityV94:\s*true/);

const memoryHandler = coldGlue.match(/function bindBrandMemory\([\s\S]*?\n  \}/)?.[0] || "";
assert.match(memoryHandler, /target\.id === "brandSelect"/);
assert.doesNotMatch(memoryHandler, /stopImmediatePropagation/);
assert.doesNotMatch(memoryHandler, /state\.selectedBrand\s*=/);

console.log("Brand selection DOM event authority v94 regression passed.");
''')


# 4. Replace the active delivery regression with v94. Historical behavioral
# tests remain; only the test that pins the live build identity moves forward.
old_delivery = Path("tests/workspace-selection-delivery-v93.test.js")
if old_delivery.exists():
    old_delivery.unlink()
write("tests/workspace-selection-delivery-v94.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const BUILD = "brand-selection-event-authority-v94-20260811-2150";
const guidance = fs.readFileSync(path.join(root, "app/controllers/specification-sensor-guidance-controller.js"), "utf8");
const setup = fs.readFileSync(path.join(root, "app/controllers/setup-event-controller-integration.js"), "utf8");
assert.match(guidance, /brandSelectionOwnedByBuildInputsV94:\s*true/);
assert.match(setup, /brandSelectionAuthorityV94:\s*true/);
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
for (const source of [bootstrap, sw, updater, app, index]) assert.match(source, new RegExp(BUILD));
assert.equal(manifest.buildId, BUILD);
console.log("Brand selection event authority and delivery v94 regression passed.");
''')


# 5. Move the client-visible build identity to v94 while retaining v93 in the
# regression lineage.
path = "app/bootstrap.js"
text = read(path)
old_const = f'  const build = "{OLD}";'
if old_const not in text:
    raise SystemExit("bootstrap v93 current build not found")
text = text.replace(old_const, f'  const build = "{NEW}";', 1)
text = text.replace(f'  const buildUpdatedAt = "{OLD_TIME}";', f'  const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
write(path, text)

for path in ["app.js", "index.html", "service-worker.js", "app/update-manager.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"v93 build identity missing from {path}")
    text = text.replace(OLD, NEW)
    text = text.replace(OLD_TIME, NEW_TIME)
    write(path, text)

# Tests that pin the currently delivered build are moved forward without
# altering their functional geometry assertions.
for test_path in Path("tests").glob("*.test.js"):
    if test_path.name == "workspace-selection-delivery-v94.test.js":
        continue
    text = test_path.read_text(encoding="utf-8")
    if OLD in text:
        test_path.write_text(text.replace(OLD, NEW), encoding="utf-8")

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v94 fixes the actual Brand-selector snap-back source. Specification & Sensor Guidance no longer intercepts Build Inputs Brand changes or workspace tab navigation, and the retired Spec # field is no longer treated as a hidden required-field gate. Brand selection is owned exclusively by the setup/Build Inputs controller; specification guidance remains advisory. v93 Brand transaction/presentation behavior, APL geometry, validator semantics, Top View, Bottle Orientation, and wipe-direction behavior remain unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
