"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const runtime = read("app/3d/scene-runtime.js");
const geometry = read("app/3d/physical-geometry-adapter.js");
const carousel = read("app/3d/carousel-layout-adapter.js");
const wipeGeometry = read("app/3d/wipe-pad-geometry-adapter.js");
const wipeMesh = read("app/3d/wipe-pad-mesh-factory.js");
const equipment = read("app/3d/equipment-layout-adapter.js");
const viewport = read("app/3d/three-scene-renderer-v05.js");
const spacingOverlay = read("app/3d/measured-spacing-overlay.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer-v05\.js/, "3D runtime must load the measured wipe-pad viewport.");
assert.match(runtime, /app\/3d\/measured-spacing-overlay\.js/, "3D runtime must retain measured plate-spacing telemetry.");
assert.match(runtime, /Labeler3DWipePadMeshFactory/, "3D runtime must require the measured wipe-pad mesh factory.");
assert.match(runtime, /wipePadRenderAuthority:\s*"measured-annular-sponge-and-steel"/, "Runtime must identify measured curved wipe rendering.");
assert.match(runtime, /equipmentCadAuthority:\s*false/, "Runtime must not claim CAD authority for unrelated map-derived equipment depth.");
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/, "Planner/physical pitch isolation must remain explicit.");

const wipeGeometryIndex = bootstrap.indexOf("app/3d/wipe-pad-geometry-adapter.js");
const wipeMeshIndex = bootstrap.indexOf("app/3d/wipe-pad-mesh-factory.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
const runtimeIndex = bootstrap.indexOf("app/3d/scene-runtime.js");
assert.ok(wipeGeometryIndex >= 0, "Bootstrap must load measured wipe geometry.");
assert.ok(wipeMeshIndex > wipeGeometryIndex, "Measured wipe mesh factory must load after its physical geometry contract.");
assert.ok(equipmentIndex > wipeMeshIndex, "Equipment layout must load after measured wipe geometry/mesh boundaries.");
assert.ok(runtimeIndex > equipmentIndex, "3D runtime must load after equipment layout.");

assert.match(geometry, /centerSpacingMm:\s*110/, "Physical geometry must preserve the user-measured 110 mm center spacing.");
assert.match(geometry, /edgeClearanceMm:\s*16/, "Physical geometry must preserve the user-measured 16 mm plate clearance.");
assert.match(geometry, /pitchRadiusFromChordSpacing/, "Physical pitch radius must remain derived from measured center spacing.");

assert.match(carousel, /servoforge\.3d-carousel\.v1/, "Carousel layout adapter must keep its versioned contract.");
assert.match(carousel, /neutral-no-invented-motion/, "Passive carousel heads must not fabricate servo motion.");

assert.match(wipeGeometry, /heightMm:\s*70/);
assert.match(wipeGeometry, /spongeThicknessMm:\s*18/);
assert.match(wipeGeometry, /backingPlateThicknessMm:\s*4/);
assert.match(wipeGeometry, /totalThicknessMm:\s*22/);
assert.match(wipeGeometry, /bottlePenetrationMm:\s*2/);
assert.match(wipeGeometry, /pad-face-overlaps-nominal-bottle-radius-by-2mm/);

assert.match(wipeMesh, /servoforge\.3d-wipe-pad-mesh\.v1/, "Measured wipe mesh factory must publish a versioned identity.");
assert.match(wipeMesh, /annularPrismGeometry/, "Wipe pads must be generated as curved annular geometry.");
assert.match(wipeMesh, /ServoForgeWipePadSponge18mm/, "Measured 18 mm sponge must remain a distinct mesh.");
assert.match(wipeMesh, /ServoForgeWipePadSteelBacking4mm/, "Measured 4 mm steel backing must remain a distinct mesh.");
assert.match(wipeMesh, /contactFaceArcLengthMm/, "Rendered wipe assembly must preserve its calculated contact-face arc length.");
assert.match(wipeMesh, /curved:\s*true/, "Measured wipe assembly must identify itself as curved.");

assert.match(equipment, /servoforge\.3d-equipment\.v1/, "Equipment adapter must publish a versioned contract.");
assert.match(equipment, /machine-map-angle-plus-user-measured-wipe-contact-geometry/, "Wipe-pad radial placement must use measured contact geometry.");
assert.match(equipment, /machine-map-aggregate-centerline/, "Aggregate centerlines must come from the active machine map.");
assert.match(equipment, /sensorFieldOfViewDegrees/, "Sensor geometry must carry machine-map field-of-view metadata.");
assert.match(equipment, /orientationTarget/, "Coding equipment must retain its orientation target metadata.");

assert.match(viewport, /servoforge\.3d-viewport\.v0\.5/, "Viewport must publish its measured wipe-pad v0.5 identity.");
assert.match(viewport, /0\.185\.1/, "Three.js must remain pinned for deterministic staging behavior.");
assert.match(viewport, /cdn\.jsdelivr\.net\/npm\/three@/, "Three.js must load from the pinned CDN module path.");
assert.match(viewport, /new THREE\.WebGLRenderer/, "Viewport must use the Three.js WebGL renderer.");
assert.match(viewport, /new THREE\.PerspectiveCamera/, "Viewport must expose a perspective 3D camera.");
assert.match(viewport, /new THREE\.LatheGeometry/, "Viewport must retain the longneck bottle profile.");
assert.match(viewport, /rebuildHeads/, "Viewport must retain the full bottle-table population.");
assert.match(viewport, /rebuildEquipment/, "Viewport must rebuild machine-map equipment when the active map changes.");
assert.match(viewport, /createAggregateAssembly/, "Viewport must render aggregate centerline equipment.");
assert.match(viewport, /createMeasuredPadAssembly/, "Viewport must render measured wipe-pad assemblies.");
assert.match(viewport, /wipeMeshFactory\(\)/, "Viewport must source pad meshes through the measured factory boundary.");
assert.match(viewport, /group\.rotation\.y = -Math\.atan2\(z, x\)/, "Measured pad curvature must be oriented radially from its actual world position.");
assert.match(viewport, /item\.kind === "roller"/, "Viewport must retain wipe rollers.");
assert.match(viewport, /item\.kind === "pad"/, "Viewport must retain wipe pads.");
assert.match(viewport, /item\.kind === "sensor"/, "Viewport must retain sensors.");
assert.match(viewport, /item\.kind === "coding"/, "Viewport must retain coder references.");
assert.match(viewport, /updateActivityHighlight/, "Active wipe activity must be able to highlight the measured sponge.");
assert.match(viewport, /activeServoPlate\.rotation\.y/, "Only the live servo plate must consume live servo rotation.");
assert.match(viewport, /activeBottleModel\.rotation\.y/, "The live bottle must consume live servo rotation.");
assert.match(viewport, /Measured Wipe Pads/, "Viewport must identify the measured wipe-pad milestone.");
assert.match(viewport, /70 mm height, 18 mm sponge, 4 mm steel backing, 22 mm total stack, and 2 mm bottle penetration/, "Viewport must disclose the measured pad authority.");
assert.match(viewport, /Vertical mounting center remains a reference/, "Viewport must disclose the remaining unmeasured vertical mount location.");
assert.match(viewport, /Follow Head 1/, "Camera follow must target the authoritative live head.");
assert.match(viewport, /requestAnimationFrame/, "Viewport must track live ServoForge preview motion.");
assert.match(viewport, /textContent = "3D View"/);

assert.match(spacingOverlay, /Plate center spacing/, "Measured-spacing overlay must retain true plate center spacing.");
assert.match(spacingOverlay, /measuredCenterSpacingMm:\s*110/);
assert.match(spacingOverlay, /measuredClearanceMm:\s*16/);
assert.match(spacingOverlay, /derivedPlateDiameterMm:\s*94/);

[
  /saveCurrentSettings\s*\(/,
  /setServoAngleOverride\s*\(/,
  /state\.program\s*=/,
  /state\.simulation/,
  /simulation\.lines\s*=/
].forEach((pattern) => {
  assert.doesNotMatch(viewport, pattern, `3D viewport must not mutate ServoForge program state: ${pattern}`);
  assert.doesNotMatch(equipment, pattern, `3D equipment adapter must not mutate ServoForge program state: ${pattern}`);
  assert.doesNotMatch(wipeMesh, pattern, `Measured wipe-pad mesh factory must remain presentation-only: ${pattern}`);
});

const syntaxSandbox = {
  window: {},
  console,
  setTimeout() { return 0; }
};
syntaxSandbox.window = syntaxSandbox;
syntaxSandbox.globalThis = syntaxSandbox;
vm.createContext(syntaxSandbox);
assert.doesNotThrow(
  () => vm.runInContext(carousel, syntaxSandbox, { filename: "app/3d/carousel-layout-adapter.js" }),
  "Carousel layout adapter must remain valid JavaScript."
);
assert.doesNotThrow(
  () => vm.runInContext(wipeMesh, syntaxSandbox, { filename: "app/3d/wipe-pad-mesh-factory.js" }),
  "Measured wipe-pad mesh factory must remain valid JavaScript."
);
assert.doesNotThrow(
  () => vm.runInContext(equipment, syntaxSandbox, { filename: "app/3d/equipment-layout-adapter.js" }),
  "Equipment layout adapter must remain valid JavaScript."
);
assert.doesNotThrow(
  () => vm.runInContext(viewport, syntaxSandbox, { filename: "app/3d/three-scene-renderer-v05.js" }),
  "Measured wipe-pad browser viewport must remain valid JavaScript."
);

console.log("ServoForge measured curved wipe-pad 3D viewport boundary regression passed.");
