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
assert.ok(simplifyIndex > linkageIndex, "Purpose-view layer must consume the final approved spender linkage.");
assert.ok(equipmentIndex > simplifyIndex, "Equipment generation must use the purpose-view hardware factory.");
assert.ok(pathIndex > equipmentIndex, "Bottle-path correction should install after equipment contracts are loaded.");
assert.ok(runtimeIndex > pathIndex, "Bottle-path correction must install before the 3D viewport runtime is injected.");

assert.match(purposeView, /v10-mounted-roller-system/);
assert.match(purposeView, /functional-placement-reference/);
assert.match(purposeView, /ServoForgeSpenderPlate/);
assert.match(purposeView, /ServoForgeSpenderRefined/);
assert.match(purposeView, /mountingArmVisible:\s*false/);
assert.match(purposeView, /supportHardwareVisible:\s*false/);
assert.match(purposeView, /guideRollerVisible:\s*false/);
assert.match(purposeView, /labelWebVisible:\s*false/);

// Roller stations intentionally reverse the earlier "roller body only" simplification.
// Only roller items present in the active machine map are generated, but each active
// roller now carries the drawing-backed support hierarchy.
assert.match(purposeView, /ServoForgePurposeViewRoller/);
assert.match(purposeView, /ServoForgeRollerSpindleShaft/);
assert.match(purposeView, /ServoForgeRollerHubLower/);
assert.match(purposeView, /ServoForgeRollerHubUpper/);
assert.match(purposeView, /ServoForgeRollerCurvedMountRail/);
assert.match(purposeView, /ServoForgeRollerVerticalSupportPost/);
assert.match(purposeView, /ServoForgeRollerSupportFoot/);
assert.match(purposeView, /ServoForgeRollerRailClamp/);
assert.match(purposeView, /ServoForgeRollerCarrierArm/);
assert.match(purposeView, /ServoForgeRollerRailKnuckle/);
assert.match(purposeView, /ServoForgeRollerHeadKnuckle/);
assert.match(purposeView, /ServoForgeRollerForkLeft/);
assert.match(purposeView, /ServoForgeRollerForkRight/);
assert.match(purposeView, /ServoForgeRollerAdjustmentStem/);
assert.match(purposeView, /ServoForgeRollerAdjustmentKnob/);
assert.match(purposeView, /shaftVisible:\s*true/);
assert.match(purposeView, /hubVisible:\s*true/);
assert.match(purposeView, /mountingArmVisible:\s*true/);
assert.match(purposeView, /supportPostVisible:\s*true/);
assert.match(purposeView, /curvedRailVisible:\s*true/);
assert.match(purposeView, /activeStationAuthority:\s*"active-machine-map-only"/);
assert.match(purposeView, /extraInactiveRollersCreated:\s*false/);
assert.match(purposeView, /activeRollerCountAuthority:\s*"active-machine-map"/);
assert.match(purposeView, /user-supplied-topmodul-sponge-roller-support-bracket-drawing/);
assert.match(purposeView, /mountingDimensionsAuthority:\s*"drawing-proportional-until-measured"/);
assert.match(purposeView, /positionAuthority:\s*"servoforge-machine-map"/);

// Functional vertical/contact references remain unchanged: the roller body follows
// the bottle neck midpoint/tangent and the later neck-contact correction can still
// find ServoForgePurposeViewRoller to apply its outside/inside tilt rule.
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

console.log("ServoForge 3D mounted roller system, purpose-view heights, and table-path correction regression passed.");
