"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const purposeView = read("app/3d/purpose-view-simplification-integration.js");
const pathCorrection = read("app/3d/bottle-path-shape-correction-integration.js");

const linkageIndex = bootstrap.indexOf("app/3d/spender-knuckle-linkage-refinement-integration.js");
const simplifyIndex = bootstrap.indexOf("app/3d/purpose-view-simplification-integration.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
const pathIndex = bootstrap.indexOf("app/3d/bottle-path-shape-correction-integration.js");
const runtimeIndex = bootstrap.indexOf("app/3d/scene-runtime.js");

assert.ok(linkageIndex >= 0);
assert.ok(simplifyIndex > linkageIndex, "Purpose-view simplification must consume the final approved spender linkage.");
assert.ok(equipmentIndex > simplifyIndex, "Equipment generation must use the simplified hardware factory.");
assert.ok(pathIndex > equipmentIndex, "Bottle-path correction should install after equipment contracts are loaded.");
assert.ok(runtimeIndex > pathIndex, "Bottle-path correction must install before the 3D viewport runtime is injected.");

assert.match(purposeView, /v9-functional-heights/);
assert.match(purposeView, /functional-placement-reference/);
assert.match(purposeView, /ServoForgeSpenderPlate/);
assert.match(purposeView, /ServoForgeSpenderRefined/);
assert.match(purposeView, /mountingArmVisible:\s*false/);
assert.match(purposeView, /supportHardwareVisible:\s*false/);
assert.match(purposeView, /guideRollerVisible:\s*false/);
assert.match(purposeView, /labelWebVisible:\s*false/);
assert.match(purposeView, /ServoForgePurposeViewRoller/);
assert.match(purposeView, /shaftVisible:\s*false/);
assert.match(purposeView, /hubVisible:\s*false/);
assert.match(purposeView, /supportPostVisible:\s*false/);
assert.match(purposeView, /mountingPostsVisible:\s*false/);
assert.match(purposeView, /crossbarVisible:\s*false/);
assert.match(purposeView, /positionAuthority:\s*"servoforge-machine-map"/);

// Functional vertical references: roller contact follows the midpoint/tangent of
// the reference bottle neck slope. Wipe-pad bottom is user-specified at 28 mm
// with the measured 70 mm pad height preserved.
assert.match(purposeView, /const WIPE_PAD_BOTTOM_MM = 28/);
assert.match(purposeView, /const WIPE_PAD_HEIGHT_MM = 70/);
assert.match(purposeView, /function neckSlopeReference\(/);
assert.match(purposeView, /const targetYmm = \(shoulderTopMm \+ finishStartMm\) \/ 2/);
assert.match(purposeView, /profilePointsMm/);
assert.match(purposeView, /radialSlope/);
assert.match(purposeView, /setFromUnitVectors/);
assert.match(purposeView, /surfaceParallelContact:\s*true/);
assert.match(purposeView, /verticalAuthority:\s*neck\.authority/);
assert.match(purposeView, /function wipePadCenterYWorld\(/);
assert.match(purposeView, /WIPE_PAD_BOTTOM_MM \+ padHeightMm \/ 2/);
assert.match(purposeView, /bodyPanelBottomMm:\s*WIPE_PAD_BOTTOM_MM/);
assert.match(purposeView, /user-specified-body-panel-bottom-28mm-plus-measured-70mm-pad-height/);

assert.match(pathCorrection, /servoforge\.3d-bottle-path\.v1-table-orbit/);
assert.match(pathCorrection, /ServoForgeBottleTableOrbitPath/);
assert.match(pathCorrection, /new THREE\.TorusGeometry\(requestedRadius, PATH_TUBE_RADIUS/);
assert.match(pathCorrection, /nativeScaleSet\(1, 1, 1\)/);
assert.match(pathCorrection, /physical-bottle-table-pitch-radius/);
assert.match(pathCorrection, /ovalScalingDisabled:\s*true/);
assert.match(pathCorrection, /followsBottleTableCenters:\s*true/);

[
  /saveCurrentSettings\s*\(/,
  /state\.program\s*=/,
  /setServoAngleOverride\s*\(/,
  /simulation\.lines\s*=/
].forEach((pattern) => {
  assert.doesNotMatch(purposeView, pattern, `Purpose view must remain read-only: ${pattern}`);
  assert.doesNotMatch(pathCorrection, pattern, `Path correction must remain read-only: ${pattern}`);
});

console.log("ServoForge 3D purpose-view heights, simplification, and table-path correction regression passed.");
