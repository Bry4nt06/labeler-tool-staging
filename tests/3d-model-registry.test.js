"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const registry = read("app/3d/models/index.js");
const router = read("app/3d/models/equipment-model-router-integration.js");
const roller = read("app/3d/models/wipe-roller.js");
const rollerPairCompat = read("app/3d/models/wipe-roller-pair-mount-authority.js");

const modelFiles = [
  "app/3d/models/bottle.js",
  "app/3d/models/star-wheel.js",
  "app/3d/models/spender.js",
  "app/3d/models/wipe-pad.js",
  "app/3d/models/wipe-roller.js",
  "app/3d/models/coder.js",
  "app/3d/models/index.js",
  "app/3d/models/equipment-model-router-integration.js"
];

test("canonical 3D model folder contains the primary ServoForge object boundaries", () => {
  modelFiles.forEach((relative) => assert.ok(fs.existsSync(path.join(root, relative)), `${relative} must exist`));
  assert.match(read("app/3d/models/bottle.js"), /id: "bottle"/);
  assert.match(read("app/3d/models/star-wheel.js"), /id: "star-wheel"/);
  assert.match(read("app/3d/models/spender.js"), /id: "spender"/);
  assert.match(read("app/3d/models/wipe-pad.js"), /id: "wipe-pad"/);
  assert.match(read("app/3d/models/wipe-roller.js"), /id: "wipe-roller"/);
  assert.match(read("app/3d/models/coder.js"), /id: "coder"/);
});

test("model registry loads after final hardware refinements and before scene presentation", () => {
  const coderHeightIndex = bootstrap.indexOf('"app/3d/coder-height-26in-refinement-integration.js"');
  const bottleIndex = bootstrap.indexOf('"app/3d/models/bottle.js"');
  const registryIndex = bootstrap.indexOf('"app/3d/models/index.js"');
  const routerIndex = bootstrap.indexOf('"app/3d/models/equipment-model-router-integration.js"');
  const starPresentationIndex = bootstrap.indexOf('"app/3d/bottle-handling-measured-star-presentation-integration.js"');
  assert.ok(coderHeightIndex >= 0);
  assert.ok(bottleIndex > coderHeightIndex);
  assert.ok(registryIndex > bottleIndex);
  assert.ok(routerIndex > registryIndex);
  assert.ok(starPresentationIndex > routerIndex);
});

test("registry exposes one canonical lookup boundary for equipment models", () => {
  assert.match(registry, /REGISTRY_VERSION = "servoforge\.3d-model-registry\.v1"/);
  assert.match(registry, /resolveEquipment/);
  assert.match(registry, /canonicalFolder: "app\/3d\/models"/);
  assert.match(registry, /servoMutationAllowed: false/);
});

test("equipment router removes the full spender application-arm family while preserving knuckle and plate", () => {
  assert.match(router, /servoforge\.3d-equipment-model-router\.v3-spender-arm-family-cleanup/);
  assert.match(router, /ServoForgeSpenderPhotoApplicationArmExtrusion/);
  assert.match(router, /ServoForgeABLabelApplicationArm/);
  assert.match(router, /ServoForgeKronesABArmSection/);
  assert.match(router, /ApplicationArm\|ABArm/);
  assert.match(router, /name\.includes\("Knuckle"\)/);
  assert.match(router, /if \(model\.id === "spender"\) stripSpenderApplicationArm\(result\)/);
  assert.match(router, /removalAuthority: "user-directed-remove-all-application-arm-variants-only"/);
  assert.match(router, /spenderPlatePreserved: true/);
  assert.match(router, /knucklePreserved: true/);
});

test("wipe roller model retains machine-photo mounting authority as reference only", () => {
  assert.match(roller, /user-supplied-topmodul-roller-photos-2026-08-19/);
  assert.match(roller, /sourceImageCount: 7/);
  assert.match(roller, /curved-round-carousel-mounting-rail/);
  assert.match(roller, /allMountingHardwareReferenceOnly: true/);
  assert.match(roller, /rollerCoreOnlyRendered: true/);
  assert.match(roller, /mountingRailVisible: false/);
  assert.match(roller, /referenceGeometryRetained: true/);
  assert.match(roller, /mountingDimensionalAuthority: false/);
});

test("wipe roller rendering contains only roller, spindle, and hubs", () => {
  assert.match(roller, /ServoForgeWipeRollerSponge/);
  assert.match(roller, /ServoForgeWipeRollerSpindle/);
  assert.match(roller, /ServoForgeWipeRollerHubLower/);
  assert.match(roller, /ServoForgeWipeRollerHubUpper/);
  assert.match(roller, /immediatePivotVisible: false/);
  assert.match(roller, /pivotPinVisible: false/);
  assert.match(roller, /pivotCapVisible: false/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerYokeUpper/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerYokeLower/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerYokeRearBridge/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerImmediatePivotBlock/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerPivotPin/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerPivotCap/);
});

test("roller mounting rails and station hardware remain non-rendered references", () => {
  assert.match(roller, /mountingRailRendered: false/);
  assert.match(roller, /longExtensionHardwareRendered: false/);
  assert.match(roller, /pivotHardwareRendered: false/);
  assert.doesNotMatch(roller, /new THREE\.TubeGeometry/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerPairMountRail/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerCurvedMountingRail/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerExtensionArm/);
  assert.doesNotMatch(roller, /ServoForgeWipeRollerRailRiser/);
  assert.match(rollerPairCompat, /railGeometryRendered: false/);
  assert.match(rollerPairCompat, /extensionArmsRendered: false/);
  assert.match(rollerPairCompat, /risersRendered: false/);
});

test("model organization layer remains read-only with respect to planner and servo state", () => {
  const combined = [...modelFiles.map(read), rollerPairCompat].join("\n");
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(combined, pattern));
});
