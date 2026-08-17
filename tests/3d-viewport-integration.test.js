"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const runtime = read("app/3d/scene-runtime.js");
const geometry = read("app/3d/physical-geometry-adapter.js");
const viewport = read("app/3d/three-scene-renderer.js");
const bootstrap = read("app/bootstrap.js");

assert.match(runtime, /app\/3d\/three-scene-renderer\.js/, "3D runtime must load the visible viewport presenter.");
assert.match(runtime, /Labeler3DPhysicalGeometryAdapter/, "3D runtime must require the physical geometry contract.");
assert.match(runtime, /v021-longneck-reference/, "3D runtime must cache-bust the longneck reference viewport build.");
assert.match(runtime, /loadViewportRenderer/, "3D runtime must expose a viewport loader boundary.");
assert.match(bootstrap, /app\/3d\/physical-geometry-adapter\.js/, "Bootstrap must load physical geometry before the 3D runtime.");

assert.match(geometry, /servoforge\.3d-geometry\.v1/, "Physical geometry adapter must publish its versioned contract.");
assert.match(geometry, /effectiveDiameterMm/, "Physical geometry must derive active bottle diameter.");
assert.match(geometry, /tablePitchRadiusMm/, "Physical geometry must consume machine pitch radius.");
assert.match(geometry, /overallHeightMm:\s*241\.5/, "Longneck reference must preserve the supplied overall height.");
assert.match(geometry, /finishOuterDiameterMm:\s*26\.6/, "Longneck reference must preserve the supplied finish diameter.");
assert.match(geometry, /mouthInnerDiameterMm:\s*17\.5/, "Longneck reference must preserve the supplied mouth diameter.");
assert.match(geometry, /shoulderNeckDiameterMm:\s*37/, "Longneck reference must preserve the supplied shoulder-neck datum.");
assert.match(geometry, /shoulderRadiusMm:\s*108/, "Longneck reference must preserve the supplied R108 shoulder reference.");
assert.match(geometry, /referenceDrawingBodyDiameterIgnored:\s*true/, "Reference drawing body diameter must never override active ServoForge Bottle Specs.");
assert.match(geometry, /derived-layout-envelope/, "Bottle-table size must be identified as derived until CAD dimensions exist.");

assert.match(viewport, /servoforge\.3d-viewport\.v0\.2\.1/, "Viewport must publish its v0.2.1 identity.");
assert.match(viewport, /0\.185\.1/, "Three.js must remain pinned for deterministic staging behavior.");
assert.match(viewport, /cdn\.jsdelivr\.net\/npm\/three@/, "Three.js must load from the pinned CDN module path.");
assert.match(viewport, /Labeler3DSceneRuntime/, "Viewport must consume the read-only 3D runtime.");
assert.match(viewport, /\.snapshot\(/, "Viewport animation must consume runtime snapshots.");
assert.match(viewport, /new THREE\.WebGLRenderer/, "Viewport must use the Three.js WebGL renderer.");
assert.match(viewport, /new THREE\.PerspectiveCamera/, "Viewport must expose a perspective 3D camera.");
assert.match(viewport, /new THREE\.LatheGeometry/, "Viewport must build the bottle from a lathed physical profile.");
assert.match(viewport, /profilePointsWorld/, "Viewport must use geometry-contract profile points rather than scalar-only bottle sizing.");
assert.match(viewport, /replaceBottleModel/, "Viewport must rebuild bottle geometry when the active physical profile changes.");
assert.match(viewport, /referenceHeightMm/, "Viewport telemetry must disclose the supplied reference height.");
assert.match(viewport, /servoPlateRotationY/, "Servo plate rendering must consume the shared scene rotation datum.");
assert.match(viewport, /requestAnimationFrame/, "Viewport must track live ServoForge preview motion.");
assert.match(viewport, /textContent = "3D View"/);
assert.match(viewport, /Drag to orbit • Wheel to zoom/);
assert.match(viewport, /Longneck Reference Profile/);
assert.match(viewport, /body diameter stays recipe-driven/, "Viewport must disclose that the supplied drawing does not override ServoForge diameter authority.");

[
  /saveCurrentSettings\s*\(/,
  /setServoAngleOverride\s*\(/,
  /state\.program\s*=/,
  /state\.simulation/,
  /simulation\.lines\s*=/
].forEach((pattern) => {
  assert.doesNotMatch(viewport, pattern, `3D viewport must not mutate ServoForge program state: ${pattern}`);
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
  () => vm.runInContext(viewport, syntaxSandbox, { filename: "app/3d/three-scene-renderer.js" }),
  "The browser viewport presenter must remain valid JavaScript."
);

console.log("ServoForge longneck-reference 3D viewport boundary regression passed.");
