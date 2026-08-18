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
const viewport = read("app/3d/three-scene-renderer-v03.js");
const spacingOverlay = read("app/3d/measured-spacing-overlay.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer-v03\.js/, "3D runtime must load the full-carousel viewport presenter.");
assert.match(runtime, /app\/3d\/measured-spacing-overlay\.js/, "3D runtime must load measured plate-spacing telemetry.");
assert.match(runtime, /Labeler3DPhysicalGeometryAdapter/, "3D runtime must require the physical geometry contract.");
assert.match(runtime, /Labeler3DCarouselLayoutAdapter/, "3D runtime must require the full-carousel layout contract.");
assert.match(runtime, /v031-measured-plate-spacing/, "3D runtime must cache-bust the measured-spacing viewport build.");
assert.match(runtime, /plannerPitchGeometryUntouched:\s*true/, "Runtime must disclose planner/physical pitch isolation.");
assert.match(runtime, /passiveServoMode:\s*"neutral-no-invented-motion"/, "Runtime must disclose the passive-head servo policy.");
assert.match(runtime, /loadViewportRenderer/, "3D runtime must expose a viewport loader boundary.");
assert.match(bootstrap, /app\/3d\/physical-geometry-adapter\.js/, "Bootstrap must load physical geometry before the 3D runtime.");
assert.match(bootstrap, /app\/3d\/carousel-layout-adapter\.js/, "Bootstrap must load carousel layout before the 3D runtime.");

assert.match(geometry, /servoforge\.3d-geometry\.v1/, "Physical geometry adapter must publish its versioned contract.");
assert.match(geometry, /centerSpacingMm:\s*110/, "Physical geometry must preserve the user-measured 110 mm center spacing.");
assert.match(geometry, /edgeClearanceMm:\s*16/, "Physical geometry must preserve the user-measured 16 mm plate clearance.");
assert.match(geometry, /pitchRadiusFromChordSpacing/, "Physical 3D pitch radius must derive from measured plate-center chord spacing.");
assert.match(geometry, /plannerPitchRadiusMm/, "Planner/map pitch radius must remain a separate geometry datum.");
assert.match(geometry, /user-measured-spacing-and-clearance/, "Bottle-table dimensional authority must identify the user measurements.");
assert.match(geometry, /overallHeightMm:\s*241\.5/, "Longneck reference must preserve the supplied overall height.");
assert.match(geometry, /referenceDrawingBodyDiameterIgnored:\s*true/, "Reference drawing body diameter must never override active ServoForge Bottle Specs.");

assert.match(carousel, /servoforge\.3d-carousel\.v1/, "Carousel layout adapter must publish a versioned contract.");
assert.match(carousel, /360\s*\/\s*headCount/, "Bottle-table angular pitch must derive from machine head count.");
assert.match(carousel, /plateCenterSpacingMm/, "Carousel contract must expose measured bottle-plate center spacing.");
assert.match(carousel, /plateClearanceMm/, "Carousel contract must expose measured bottle-plate clearance.");
assert.match(carousel, /plateDiameterMm/, "Carousel contract must expose resolved bottle-plate diameter.");
assert.match(carousel, /primaryTableAngle\s*-\s*index\s*\*\s*pitchDegrees/, "Higher heads must trail Head 1 by exact table pitch.");
assert.match(carousel, /neutral-no-invented-motion/, "Passive carousel heads must not fabricate servo motion.");
assert.match(carousel, /machineOrbit/, "Carousel population must reuse ServoForge map-coordinate transforms.");

assert.match(viewport, /servoforge\.3d-viewport\.v0\.3/, "Viewport must retain its full-carousel v0.3 presenter identity.");
assert.match(viewport, /0\.185\.1/, "Three.js must remain pinned for deterministic staging behavior.");
assert.match(viewport, /cdn\.jsdelivr\.net\/npm\/three@/, "Three.js must load from the pinned CDN module path.");
assert.match(viewport, /Labeler3DSceneRuntime/, "Viewport must consume the read-only 3D runtime.");
assert.match(viewport, /\.snapshot\(/, "Viewport animation must consume runtime snapshots.");
assert.match(viewport, /new THREE\.WebGLRenderer/, "Viewport must use the Three.js WebGL renderer.");
assert.match(viewport, /new THREE\.PerspectiveCamera/, "Viewport must expose a perspective 3D camera.");
assert.match(viewport, /new THREE\.LatheGeometry/, "Viewport must retain the longneck bottle profile.");
assert.match(viewport, /profilePointsWorld/, "Viewport must use geometry-contract bottle profile points.");
assert.match(viewport, /rebuildCarouselHeads/, "Viewport must rebuild the complete bottle-table population when machine geometry changes.");
assert.match(viewport, /snapshot\?\.carousel\?\.heads/, "Viewport must position tables from the runtime carousel contract.");
assert.match(viewport, /activeServoPlate\.rotation\.y/, "Only the live servo plate must consume live servo rotation.");
assert.match(viewport, /activeBottleModel\.rotation\.y/, "The live bottle must consume live servo rotation.");
assert.match(viewport, /Full Carousel/, "Viewport must identify the full-carousel milestone.");
assert.match(viewport, /Head 1 is live/, "Viewport must explain the active-head boundary.");
assert.match(viewport, /Follow Head 1/, "Camera follow must target the authoritative live head.");
assert.match(viewport, /Bottle tables/, "Viewport telemetry must expose machine table count.");
assert.match(viewport, /requestAnimationFrame/, "Viewport must track live ServoForge preview motion.");
assert.match(viewport, /textContent = "3D View"/);
assert.match(viewport, /Drag to orbit • Wheel to zoom/);

assert.match(spacingOverlay, /Plate center spacing/, "Measured-spacing overlay must show true plate center spacing.");
assert.match(spacingOverlay, /Plate clearance/, "Measured-spacing overlay must show true plate clearance.");
assert.match(spacingOverlay, /Plate diameter/, "Measured-spacing overlay must show resolved 94 mm plate diameter.");
assert.match(spacingOverlay, /Planner\/map radius/, "Measured-spacing overlay must distinguish planner radius from physical pitch radius.");
assert.match(spacingOverlay, /measuredCenterSpacingMm:\s*110/, "Telemetry contract must retain the 110 mm user measurement.");
assert.match(spacingOverlay, /measuredClearanceMm:\s*16/, "Telemetry contract must retain the 16 mm user measurement.");
assert.match(spacingOverlay, /derivedPlateDiameterMm:\s*94/, "Telemetry contract must retain the 94 mm resolved plate diameter.");
assert.match(spacingOverlay, /readOnly:\s*true/, "Measured-spacing overlay must remain read-only.");

[
  /saveCurrentSettings\s*\(/,
  /setServoAngleOverride\s*\(/,
  /state\.program\s*=/,
  /state\.simulation/,
  /simulation\.lines\s*=/
].forEach((pattern) => {
  assert.doesNotMatch(viewport, pattern, `3D viewport must not mutate ServoForge program state: ${pattern}`);
  assert.doesNotMatch(spacingOverlay, pattern, `3D measured-spacing overlay must not mutate ServoForge program state: ${pattern}`);
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
  "The carousel layout adapter must remain valid JavaScript."
);
assert.doesNotThrow(
  () => vm.runInContext(viewport, syntaxSandbox, { filename: "app/3d/three-scene-renderer-v03.js" }),
  "The full-carousel browser viewport presenter must remain valid JavaScript."
);

console.log("ServoForge measured-spacing full-carousel 3D viewport boundary regression passed.");
