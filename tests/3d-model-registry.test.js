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

test("equipment router preserves current visuals through captured legacy factory", () => {
  assert.match(router, /const legacyFactory = global\.Labeler3DHardwareMeshFactory/);
  assert.match(router, /registry\.resolveEquipment\(item\)/);
  assert.match(router, /legacyFactory\.createEquipmentAssembly\(THREE, item, geometry\)/);
  assert.match(router, /visualCompatibilityMode: true/);
});

test("wipe roller model retains the user-machine mounting photos as reference authority", () => {
  assert.match(roller, /user-supplied-topmodul-roller-photos-2026-08-19/);
  assert.match(roller, /sourceImageCount: 7/);
  assert.match(roller, /curved-round-carousel-mounting-rail/);
  assert.match(roller, /individually-adjustable-roller-head-links/);
  assert.match(roller, /u-shaped-top-bottom-roller-yoke/);
  assert.match(roller, /insideAndOutsideUseSameHardwareFamily: true/);
  assert.match(roller, /directRollerHardwareVisible: true/);
  assert.match(roller, /stationMountingHardwareVisible: false/);
  assert.match(roller, /mountingRailVisible: false/);
  assert.match(roller, /referenceGeometryRetained: true/);
  assert.match(roller, /mountingDimensionalAuthority: false/);
});

test("wipe roller standing rules point every direct-head assembly at the exact carousel center", () => {
  assert.match(roller, /rollerIsBottleFacingTerminal: true/);
  assert.match(roller, /mountingHardwareExtendsAwayFromBottle: true/);
  assert.match(roller, /directHeadHardwareOnSingleCarouselRadialCenterline: true/);
  assert.match(roller, /directHeadHardwarePointsToCarouselCenter: true/);
  assert.match(roller, /centerSeekingAxisIgnoresInnerOuterSide: true/);
  assert.match(roller, /radialCenterlineAuthority: "carousel-center-through-bottle-plate-center-through-roller-head-center"/);
  assert.match(roller, /radialTarget: "exact-carousel-center-0-0"/);
  assert.match(roller, /const centerSeekingRadial = new THREE\.Vector3\(-outward\.x, 0, -outward\.z\)/);
  assert.doesNotMatch(roller, /const mountSign = item\?\.side/);
  assert.match(roller, /centerSeekingCarousel = true/);
  assert.match(roller, /radialCenterlineMember = true/);
});

test("model organization layer remains read-only with respect to planner and servo state", () => {
  const combined = modelFiles.map(read).join("\n");
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(combined, pattern));
});
