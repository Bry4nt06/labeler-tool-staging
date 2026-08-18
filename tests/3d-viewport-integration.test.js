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
const equipment = read("app/3d/equipment-layout-adapter.js");
const viewport = read("app/3d/three-scene-renderer-v04.js");
const spacingOverlay = read("app/3d/measured-spacing-overlay.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer-v04\.js/, "3D runtime must load the machine-map equipment viewport.");
assert.match(runtime, /app\/3d\/measured-spacing-overlay\.js/, "3D runtime must retain measured plate-spacing telemetry.");
assert.match(runtime, /Labeler3DEquipmentLayoutAdapter/, "3D runtime must require the machine-map equipment contract.");
assert.match(runtime, /equipmentCadAuthority:\s*false/, "Runtime must not claim CAD authority for map-derived equipment depth.");
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/, "Planner/physical pitch isolation must remain explicit.");
assert.match(bootstrap, /app\/3d\/equipment-layout-adapter\.js/, "Bootstrap must load equipment layout before the 3D runtime.");

assert.match(geometry, /centerSpacingMm:\s*110/, "Physical geometry must preserve the user-measured 110 mm center spacing.");
assert.match(geometry, /edgeClearanceMm:\s*16/, "Physical geometry must preserve the user-measured 16 mm plate clearance.");
assert.match(geometry, /pitchRadiusFromChordSpacing/, "Physical pitch radius must remain derived from measured center spacing.");

assert.match(carousel, /servoforge\.3d-carousel\.v1/, "Carousel layout adapter must keep its versioned contract.");
assert.match(carousel, /neutral-no-invented-motion/, "Passive carousel heads must not fabricate servo motion.");

assert.match(equipment, /servoforge\.3d-equipment\.v1/, "Equipment adapter must publish a versioned contract.");
assert.match(equipment, /machine-map-angle-plus-derived-radial-depth/, "Object placement must distinguish map angle from derived radial depth.");
assert.match(equipment, /radialCadAuthority:\s*false/, "Equipment radial placement must not be presented as CAD-authoritative.");
assert.match(equipment, /machine-map-aggregate-centerline/, "Aggregate centerlines must come from the active machine map.");
assert.match(equipment, /sensorFieldOfViewDegrees/, "Sensor geometry must carry machine-map field-of-view metadata.");
assert.match(equipment, /orientationTarget/, "Coding equipment must retain its orientation target metadata.");

assert.match(viewport, /servoforge\.3d-viewport\.v0\.4/, "Viewport must publish its machine-map-equipment v0.4 identity.");
assert.match(viewport, /0\.185\.1/, "Three.js must remain pinned for deterministic staging behavior.");
assert.match(viewport, /cdn\.jsdelivr\.net\/npm\/three@/, "Three.js must load from the pinned CDN module path.");
assert.match(viewport, /new THREE\.WebGLRenderer/, "Viewport must use the Three.js WebGL renderer.");
assert.match(viewport, /new THREE\.PerspectiveCamera/, "Viewport must expose a perspective 3D camera.");
assert.match(viewport, /new THREE\.LatheGeometry/, "Viewport must retain the longneck bottle profile.");
assert.match(viewport, /rebuildHeads/, "Viewport must retain the full bottle-table population.");
assert.match(viewport, /rebuildEquipment/, "Viewport must rebuild machine-map equipment when the active map changes.");
assert.match(viewport, /createAggregateAssembly/, "Viewport must render aggregate centerline equipment.");
assert.match(viewport, /createEquipmentAssembly/, "Viewport must render machine-map objects by kind.");
assert.match(viewport, /item\.kind === "roller"/, "Viewport must render wipe rollers.");
assert.match(viewport, /item\.kind === "pad"/, "Viewport must render wipe pads.");
assert.match(viewport, /item\.kind === "sensor"/, "Viewport must render sensors.");
assert.match(viewport, /item\.kind === "coding"/, "Viewport must render coder references.");
assert.match(viewport, /updateAggregateHighlight/, "Active servo activity must be able to highlight its aggregate.");
assert.match(viewport, /activeServoPlate\.rotation\.y/, "Only the live servo plate must consume live servo rotation.");
assert.match(viewport, /activeBottleModel\.rotation\.y/, "The live bottle must consume live servo rotation.");
assert.match(viewport, /Machine Map Equipment/, "Viewport must identify the machine-map equipment milestone.");
assert.match(viewport, /angular locations come directly from the active machine map/, "Viewport must disclose angular authority.");
assert.match(viewport, /Radial stand-off and housing dimensions are map-derived approximations/, "Viewport must disclose non-CAD radial geometry.");
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
  () => vm.runInContext(equipment, syntaxSandbox, { filename: "app/3d/equipment-layout-adapter.js" }),
  "Equipment layout adapter must remain valid JavaScript."
);
assert.doesNotThrow(
  () => vm.runInContext(viewport, syntaxSandbox, { filename: "app/3d/three-scene-renderer-v04.js" }),
  "Machine-map browser viewport must remain valid JavaScript."
);

console.log("ServoForge machine-map equipment 3D viewport boundary regression passed.");
