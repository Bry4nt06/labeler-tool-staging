from pathlib import Path
import json

OLD = "coder-left-edge-parity-v98-20260813-1402"
NEW = "coder-servo-direction-transform-v99-20260813-1436"
OLD_TIME = "Aug 13, 2026 2:02 PM ET"
NEW_TIME = "Aug 13, 2026 2:36 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def replace_required(text, old, new, label):
    if old not in text:
        raise SystemExit(f"missing {label}")
    return text.replace(old, new, 1)


# 1. Keep the artwork datum fixed, but convert that canonical label datum into
# the legacy/internal servo coordinate used by the selected machine direction.
path = "drivers/profile/coder-orientation-driver.js"
text = read(path)
text = replace_required(
    text,
    '''  function physicalDirection(storedDirection) {
    // Saved maps use the original coordinate-system names. Translate them at
    // the geometry boundary instead of changing stored map coordinates.
    return normalizedStoredDirection(storedDirection) === "cw" ? "ccw" : "cw";
  }
''',
    '''  function physicalDirection(storedDirection) {
    // Saved maps use the original coordinate-system names. Translate them at
    // the geometry boundary instead of changing stored map coordinates.
    return normalizedStoredDirection(storedDirection) === "cw" ? "ccw" : "cw";
  }

  function directionLabel(storedDirection) {
    return physicalDirection(storedDirection) === "cw" ? "Clockwise" : "Counter-clockwise";
  }

  function servoDirectionSign(storedDirection) {
    // This is the same local bottle/plate sign used by the Mechanical Map.
    // Stored `ccw` advances positive on screen (physical CW); stored `cw`
    // advances negative (physical CCW).
    return normalizedStoredDirection(storedDirection) === "cw" ? -1 : 1;
  }
''',
    "direction helpers"
)
text = replace_required(
    text,
    '''    const direction = physicalDirection(storedDirection);
    // Code Box Center From Left Label Edge is a direction-invariant printed-
    // label datum. Machine direction is applied later by the world/servo
    // transform; swapping to the opposite label edge here mirrors twice.
    const rawTarget = center - offset;
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));
    return {
      target,
      rawTarget,
      physicalDirection: direction,
      storedDirection: normalizedStoredDirection(storedDirection),
''',
    '''    const stored = normalizedStoredDirection(storedDirection);
    const direction = physicalDirection(stored);
    const servoSign = servoDirectionSign(stored);

    // First resolve one immutable point on the printed artwork. For Body/Back
    // leading-edge application this simplifies to application + code-box
    // distance from the printed left edge. Reversing the machine must never
    // substitute labelWidth - codeBoxOffset (the opposite end of the artwork).
    const printedDatum = center - offset;

    // The Mechanical Map uses opposite local plate signs for the two legacy
    // stored direction tokens. Convert the same printed datum into that servo
    // coordinate here. The physical target therefore remains identical while
    // the HMI/CMD plate target can be greater or smaller after a direction flip.
    const rawTarget = servoSign * printedDatum;
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));
    return {
      target,
      rawTarget,
      physicalDirection: direction,
      storedDirection: stored,
      servoDirectionSign: servoSign,
      printedCodeBoxDatum: printedDatum,
''',
    "direction-aware coder command transform"
)
text = replace_required(
    text,
    '''      targetReference: "printed-label-left-edge",
      directionInvariantLeftEdge: true
''',
    '''      targetReference: "printed-label-left-edge",
      directionInvariantLeftEdge: true,
      directionDependentServoCommand: true
''',
    "coder metadata"
)
text = replace_required(
    text,
    '''    normalizedStoredDirection,
    physicalDirection,
    nearestEquivalent,
''',
    '''    normalizedStoredDirection,
    physicalDirection,
    directionLabel,
    servoDirectionSign,
    nearestEquivalent,
''',
    "driver exports"
)
write(path, text)


# 2. Correct the operator-facing Map Builder labels without migrating or
# rewriting saved maps. Values remain the legacy internal tokens.
path = "index.html"
text = read(path)
text = replace_required(
    text,
    '<label>Direction<select id="mapDirection"><option value="cw">Clockwise</option><option value="ccw">Counter-clockwise</option></select></label>',
    '<label>Direction<select id="mapDirection"><option value="cw">Counter-clockwise</option><option value="ccw">Clockwise</option></select></label>',
    "Map Builder physical direction labels"
)
write(path, text)


# 3. Wipe presentation must consume the physical direction, not the legacy
# stored token shown by the select value. Keep CW=L->R / CCW=R->L semantics.
path = "app/wipe-telemetry-service.js"
text = read(path)
old = '''function liveWipeMachineDirection() {
  // Use the operator-facing Map Builder direction first. The legacy
  // runtime state.direction uses the opposite internal motion convention,
  // so it is only an inverted fallback when no semantic map direction exists.
  const selected = typeof document !== "undefined"
    ? String(document.getElementById("mapDirection")?.value || "").toLowerCase()
    : "";
  if (selected === "cw" || selected === "ccw") return selected;
  try {
    const configured = String(activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();
    if (configured === "cw" || configured === "ccw") return configured;
  } catch {
    // Fall through to the internal runtime convention below.
  }
  const runtime = String(state.direction || "").toLowerCase();
  if (runtime === "cw") return "ccw";
  if (runtime === "ccw") return "cw";
  return "ccw";
}
'''
new = '''function physicalWipeMachineDirection(value) {
  const stored = String(value || "").toLowerCase() === "cw" ? "cw" : "ccw";
  const driver = typeof window !== "undefined" ? window.LabelerCoderOrientationDriver : null;
  if (typeof driver?.physicalDirection === "function") return driver.physicalDirection(stored);
  return stored === "cw" ? "ccw" : "cw";
}

function liveWipeMachineDirection() {
  // Map Builder values intentionally retain the legacy stored coordinate token
  // for saved-map compatibility. Translate that token before presenting a
  // physical CW/CCW wipe direction to the operator.
  const selected = typeof document !== "undefined"
    ? String(document.getElementById("mapDirection")?.value || "").toLowerCase()
    : "";
  if (selected === "cw" || selected === "ccw") return physicalWipeMachineDirection(selected);
  try {
    const configured = String(activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();
    if (configured === "cw" || configured === "ccw") return physicalWipeMachineDirection(configured);
  } catch {
    // Fall through to the runtime coordinate token below.
  }
  const runtime = String(state.direction || "").toLowerCase();
  if (runtime === "cw" || runtime === "ccw") return physicalWipeMachineDirection(runtime);
  return "cw";
}
'''
text = replace_required(text, old, new, "wipe physical direction translation")
text = replace_required(
    text,
    '''  wipeObjectSideForRow,
''',
    '''  wipeObjectSideForRow,
  physicalWipeMachineDirection,
''',
    "wipe direction helper export"
)
write(path, text)


# 4. Bottle Orientation uses legacy direction for geometry transforms, but any
# human-facing left/right wipe fallback must use physical machine direction.
path = "app/bottle-orientation-panel-integration.js"
text = read(path)
text = replace_required(
    text,
    '''  function machineVisualAngle(angleDeg) {
    const angle = finite(angleDeg, 0);
    return String(runtimeState()?.direction || "cw").toLowerCase() === "cw" ? -angle : angle;
  }

  function tableFrameVisualAngle(tableAngle) {''',
    '''  function physicalMachineDirection() {
    const stored = String(runtimeState()?.direction || "ccw").toLowerCase() === "cw" ? "cw" : "ccw";
    const driver = global.LabelerCoderOrientationDriver;
    if (typeof driver?.physicalDirection === "function") return driver.physicalDirection(stored);
    return stored === "cw" ? "ccw" : "cw";
  }

  function machineVisualAngle(angleDeg) {
    const angle = finite(angleDeg, 0);
    return String(runtimeState()?.direction || "cw").toLowerCase() === "cw" ? -angle : angle;
  }

  function tableFrameVisualAngle(tableAngle) {''',
    "bottle physical direction helper"
)
text = text.replace('if (!coverage.direction) coverage.direction = runtimeState()?.direction === "cw" ? "ltr" : "rtl";', 'if (!coverage.direction) coverage.direction = physicalMachineDirection() === "cw" ? "ltr" : "rtl";')
text = text.replace('(runtimeState()?.direction === "cw" ? "ltr" : "rtl")', '(physicalMachineDirection() === "cw" ? "ltr" : "rtl")')
write(path, text)


# 5. Replace the v98 regression, which incorrectly required equal numeric servo
# commands, with a physical-datum/servo-coordinate regression.
v98_test = Path("tests/coder-left-edge-direction-parity-v98.test.js")
if v98_test.exists():
    v98_test.unlink()

write("tests/coder-servo-direction-transform-v99.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const driver = require("../drivers/profile/coder-orientation-driver.js");

function norm(value) {
  let angle = Number(value) % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function samePhysicalAngle(a, b) {
  const delta = Math.abs(norm(a) - norm(b));
  return Math.min(delta, 360 - delta) < 1e-9;
}

// Legacy saved direction tokens are the opposite of their physical motion.
assert.equal(driver.physicalDirection("ccw"), "cw");
assert.equal(driver.directionLabel("ccw"), "Clockwise");
assert.equal(driver.servoDirectionSign("ccw"), 1);
assert.equal(driver.physicalDirection("cw"), "ccw");
assert.equal(driver.directionLabel("cw"), "Counter-clockwise");
assert.equal(driver.servoDirectionSign("cw"), -1);

// Same printed artwork point, different servo coordinate. The code box remains
// 20° from the same printed left edge; only the HMI plate target changes.
const generic = {
  section: "back",
  applicationTarget: 0,
  labelWidthDeg: 100,
  codeBoxOffsetDeg: 20,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 0
};
const physicalCw = driver.codeBoxTarget({ ...generic, storedDirection: "ccw" });
const physicalCcw = driver.codeBoxTarget({ ...generic, storedDirection: "cw" });
assert.equal(physicalCw.printedCodeBoxDatum, 20);
assert.equal(physicalCcw.printedCodeBoxDatum, 20);
assert.equal(physicalCw.referenceEdge, "left");
assert.equal(physicalCcw.referenceEdge, "left");
assert.equal(physicalCw.rawTarget, 20);
assert.equal(physicalCcw.rawTarget, -20);
assert.notEqual(physicalCw.rawTarget, physicalCcw.rawTarget);
assert.ok(samePhysicalAngle(
  physicalCw.servoDirectionSign * physicalCw.rawTarget,
  physicalCcw.servoDirectionSign * physicalCcw.rawTarget
));
assert.equal(physicalCw.directionDependentServoCommand, true);
assert.equal(physicalCcw.directionDependentServoCommand, true);

// LandShark production geometry: the artwork datum stays fixed, while the
// nearest continuous plate command lands on opposite numeric sides of 180°.
const circumferenceMm = (60.68 - 0.3 * 2) * Math.PI;
const labelWidthDeg = 47.498 / circumferenceMm * 360;
const codeBoxOffsetDeg = 15 / circumferenceMm * 360;
const applicationTarget = 180 - labelWidthDeg / 2;
const landshark = {
  section: "back",
  applicationTarget,
  labelWidthDeg,
  codeBoxOffsetDeg,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 180
};
const landCw = driver.codeBoxTarget({ ...landshark, storedDirection: "ccw" });
const landCcw = driver.codeBoxTarget({ ...landshark, storedDirection: "cw" });
const expectedPrintedDatum = applicationTarget + codeBoxOffsetDeg;
assert.ok(Math.abs(landCw.printedCodeBoxDatum - expectedPrintedDatum) < 1e-9);
assert.ok(Math.abs(landCcw.printedCodeBoxDatum - expectedPrintedDatum) < 1e-9);
assert.notEqual(landCw.target, landCcw.target, "Direction reversal must be allowed to require more/less bottle rotation.");
assert.ok(samePhysicalAngle(
  landCw.servoDirectionSign * landCw.rawTarget,
  landCcw.servoDirectionSign * landCcw.rawTarget
), "Both commands must resolve to the same physical printed code-box datum.");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const wipe = fs.readFileSync(path.join(root, "app", "wipe-telemetry-service.js"), "utf8");
const bottle = fs.readFileSync(path.join(root, "app", "bottle-orientation-panel-integration.js"), "utf8");
const integration = fs.readFileSync(path.join(root, "app", "apl-coder-codebox-orientation-integration.js"), "utf8");
assert.match(index, /value="cw">Counter-clockwise<\/option><option value="ccw">Clockwise<\/option>/);
assert.match(wipe, /function physicalWipeMachineDirection/);
assert.match(wipe, /return physicalWipeMachineDirection\(selected\)/);
assert.match(wipe, /liveWipeMachineDirection\(\) === "cw" \? "ltr" : "rtl"/);
assert.match(bottle, /function physicalMachineDirection/);
assert.match(bottle, /coverage\.direction = physicalMachineDirection\(\) === "cw" \? "ltr" : "rtl"/);
assert.match(integration, /const rotation = targetInfo\.target - currentPlate/);
assert.match(integration, /plateAngle: finish\(targetInfo\.target\)/);
assert.match(integration, /codingWindowCenter:\s*finish\(coderCenter\)/);
console.log("Coder servo direction transform v99 regression passed.");
''')


# 6. Architecture note: same printed edge, direction-dependent servo coordinate.
path = "docs/architecture/refactor-phase-2-coder-orientation.md"
text = read(path)
old_note = "- historical note: the original driver produced 80° and 20° logical targets in opposite directions; v98 supersedes that assumption because Code Box Center From Left Label Edge is direction-invariant and physical mirroring belongs to the world/servo transform;"
new_note = "- v99 separates the direction-invariant printed Code Box Center From Left Label Edge datum from the direction-dependent legacy servo coordinate; CW/CCW may therefore require different HMI plate targets without moving the code box to the opposite end of the artwork;"
text = replace_required(text, old_note, new_note, "coder architecture v98 note")
write(path, text)


# 7. Publish a distinct staging build so installed PWAs cannot reuse v98 assets.
path = "app/bootstrap.js"
text = read(path)
text = replace_required(text, f'const build = "{OLD}";', f'const build = "{NEW}";', "bootstrap build")
text = text.replace(f'const buildUpdatedAt = "{OLD_TIME}";', f'const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
write(path, text)

for path in ["app.js", "index.html", "service-worker.js", "app/update-manager.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"missing v98 build identity in {path}")
    text = text.replace(OLD, NEW)
    text = text.replace(OLD_TIME, NEW_TIME)
    write(path, text)

for test_path in Path("tests").glob("*.test.*"):
    text = test_path.read_text(encoding="utf-8")
    if OLD in text:
        test_path.write_text(text.replace(OLD, NEW), encoding="utf-8")

manifest_path = Path("update-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["buildId"] = NEW
manifest["notes"] = (
    "v99 corrects physical CW/CCW labeling while preserving legacy saved-map direction tokens, and separates the fixed printed Code Box Center From Left Label Edge datum from the direction-dependent servo plate coordinate. Reversing machine direction can now produce a greater or smaller CMD 7/CMD 3 bottle target while still presenting the same point on the artwork to the coder. Wipe presentation consumes physical direction; coder timing, APL label geometry, Top View world-frame geometry, Brand selection, Community Library, and validator rules are otherwise unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
