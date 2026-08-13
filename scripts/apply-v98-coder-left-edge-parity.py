from pathlib import Path
import json

OLD = "community-library-v97-20260812-1918"
NEW = "coder-left-edge-parity-v98-20260813-1402"
OLD_TIME = "Aug 12, 2026 7:18 PM ET"
NEW_TIME = "Aug 13, 2026 2:02 PM ET"


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


# 1. The code box is a printed-label datum measured from the same physical
# left edge regardless of machine direction. World/table rendering already
# mirrors CW/CCW, so changing the logical label edge here double-mirrors it.
path = "drivers/profile/coder-orientation-driver.js"
text = read(path)
old = '''    const direction = physicalDirection(storedDirection);
    const rawTarget = center + (direction === "cw" ? -offset : offset);
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));'''
new = '''    const direction = physicalDirection(storedDirection);
    // Code Box Center From Left Label Edge is a direction-invariant printed-
    // label datum. Machine direction is applied later by the world/servo
    // transform; swapping to the opposite label edge here mirrors twice.
    const rawTarget = center - offset;
    const target = nearestEquivalent(rawTarget, finite(currentPlateAngle, rawTarget));'''
if old not in text:
    raise SystemExit("coder target direction block not found")
text = text.replace(old, new, 1)
old_meta = '''      leftEdgeOffset: offset,
      referenceEdge: "left"'''
new_meta = '''      leftEdgeOffset: offset,
      referenceEdge: "left",
      targetReference: "printed-label-left-edge",
      directionInvariantLeftEdge: true'''
if old_meta not in text:
    raise SystemExit("coder target metadata block not found")
text = text.replace(old_meta, new_meta, 1)
write(path, text)


# 2. Preserve the pre-coder hold timing but expose the physical coder center so
# diagnostics/tests can prove the held bottle crosses the center at the same
# mirrored distance in both machine directions.
path = "app/apl-coder-codebox-orientation-integration.js"
text = read(path)
old = '''    if (Number.isFinite(coderStart) && Number.isFinite(coderEnd)) {
      while (coderEnd <= coderStart + EPS) coderEnd += 360;
    }

    const geometry = {'''
new = '''    if (Number.isFinite(coderStart) && Number.isFinite(coderEnd)) {
      while (coderEnd <= coderStart + EPS) coderEnd += 360;
    }
    const coderCenter = Number.isFinite(coderStart) && Number.isFinite(coderEnd)
      ? coderStart + (coderEnd - coderStart) / 2
      : NaN;

    const geometry = {'''
if old not in text:
    raise SystemExit("coder center insertion anchor not found")
text = text.replace(old, new, 1)
old = '''      coderStart,
      coderEnd
    };'''
new = '''      coderStart,
      coderEnd,
      coderCenter
    };'''
if old not in text:
    raise SystemExit("coder geometry end anchor not found")
text = text.replace(old, new, 1)
old = '''      codingWindowStart: finish(coderStart),
      codingWindowStop: finish(coderEnd),
      codingReadyTableAngle: finish(readyTable),'''
new = '''      codingWindowStart: finish(coderStart),
      codingWindowStop: finish(coderEnd),
      codingWindowCenter: finish(coderCenter),
      codingReadyTableAngle: finish(readyTable),'''
if old not in text:
    raise SystemExit("coder shared metadata anchor not found")
text = text.replace(old, new, 1)
write(path, text)


# 3. Correct the architecture note so future refactors do not reintroduce the
# obsolete direction-dependent 20/80 printed-edge assumption.
path = "docs/architecture/refactor-phase-2-coder-orientation.md"
text = read(path)
needle = "- a 100° label with a 20° code-box offset produces targets of 80° and 20° in opposite physical directions;"
replacement = "- historical note: the original driver produced 80° and 20° logical targets in opposite directions; v98 supersedes that assumption because Code Box Center From Left Label Edge is direction-invariant and physical mirroring belongs to the world/servo transform;"
if needle not in text:
    raise SystemExit("architecture direction assumption line not found")
text = text.replace(needle, replacement, 1)
write(path, text)


# 4. Regression for the exact field observation: identical printed code-box
# point in both directions, with equal mirrored table distance to coder center.
write("tests/coder-left-edge-direction-parity-v98.test.js", '''"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const driver = require("../drivers/profile/coder-orientation-driver.js");

function norm(value) {
  let angle = Number(value) % 360;
  if (angle < 0) angle += 360;
  return angle;
}

function worldAngle(storedAngle, storedDirection) {
  const signed = storedDirection === "cw" ? -1 : 1;
  const zeroBase = storedDirection === "cw" ? 180 : 0;
  return norm(zeroBase + signed * Number(storedAngle));
}

function circularDistance(a, b) {
  const delta = Math.abs(norm(a) - norm(b));
  return Math.min(delta, 360 - delta);
}

const generic = {
  section: "back",
  applicationTarget: 0,
  labelWidthDeg: 100,
  codeBoxOffsetDeg: 20,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 20
};
const ccw = driver.codeBoxTarget({ ...generic, storedDirection: "ccw" });
const cw = driver.codeBoxTarget({ ...generic, storedDirection: "cw" });
assert.equal(ccw.rawTarget, 20, "20° from the printed left edge must remain 20° logically.");
assert.equal(cw.rawTarget, 20, "Changing machine direction must not swap to the opposite printed edge.");
assert.equal(ccw.target, cw.target);
assert.equal(ccw.referenceEdge, "left");
assert.equal(cw.referenceEdge, "left");
assert.equal(ccw.directionInvariantLeftEdge, true);
assert.equal(cw.directionInvariantLeftEdge, true);
assert.notEqual(ccw.physicalDirection, cw.physicalDirection, "Physical machine direction metadata still changes.");

// LandShark back-label values from the shipped catalog. The old calculation
// separated CW/CCW by ~33°, which is large enough to produce the photographed
// mismatch at the coder. v98 keeps the exact printed code-box datum identical.
const circumferenceMm = 188.747;
const labelWidthDeg = 47.498 / circumferenceMm * 360;
const codeBoxOffsetDeg = 15 / circumferenceMm * 360;
const landshark = {
  section: "back",
  applicationTarget: 90,
  labelWidthDeg,
  codeBoxOffsetDeg,
  inspectionOffsetDeg: 0,
  currentPlateAngle: 120
};
const landCcw = driver.codeBoxTarget({ ...landshark, storedDirection: "ccw" });
const landCw = driver.codeBoxTarget({ ...landshark, storedDirection: "cw" });
assert.ok(Math.abs(landCcw.rawTarget - landCw.rawTarget) < 1e-9);
assert.ok(Math.abs(landCcw.rawTarget - (90 + codeBoxOffsetDeg)) < 1e-9);

// Default coder window is 304°–309°. CMD 3 starts holding at 299° and remains
// stationary through the 306.5° coder center. World mirroring must preserve
// that same 7.5° physical table separation in both directions.
const ready = 299;
const coderCenter = 306.5;
assert.equal(circularDistance(worldAngle(ready, "ccw"), worldAngle(coderCenter, "ccw")), 7.5);
assert.equal(circularDistance(worldAngle(ready, "cw"), worldAngle(coderCenter, "cw")), 7.5);

const integration = fs.readFileSync(path.join(__dirname, "..", "app", "apl-coder-codebox-orientation-integration.js"), "utf8");
assert.match(integration, /codingWindowCenter:\s*finish\(coderCenter\)/);
assert.match(integration, /const readyTable = coderStart - PRE_CODER_MARGIN_DEG/);
console.log("Coder left-edge direction parity v98 regression passed.");
''')


# 5. Publish v98 through the client-visible staging identity. Tests that only
# pin the active delivery build move forward; their functional assertions stay.
path = "app/bootstrap.js"
text = read(path)
if f'const build = "{OLD}";' not in text:
    raise SystemExit("bootstrap current v97 build not found")
text = text.replace(f'const build = "{OLD}";', f'const build = "{NEW}";', 1)
text = text.replace(f'const buildUpdatedAt = "{OLD_TIME}";', f'const buildUpdatedAt = "{NEW_TIME}";', 1)
text = text.replace(f'// Regression lineage: {OLD} •', f'// Regression lineage: {NEW} • {OLD} •', 1)
write(path, text)

for path in ["app.js", "index.html", "service-worker.js", "app/update-manager.js"]:
    text = read(path)
    if OLD not in text:
        raise SystemExit(f"v97 build identity missing from {path}")
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
    "v98 fixes CW/CCW coder orientation parity. Code Box Center From Left Label Edge is now treated as the same printed-label datum in both machine directions; the mechanical-map/world transform alone performs the physical mirror. The pre-coder hold timing is preserved and coder-center metadata verifies equal mirrored hold distance through the coding window. Community Library, Feedback/Ratings, v94 Brand selection, Top View Bottle Orientation, v89/v90 wipe semantics, APL geometry, and validator behavior are unchanged."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
