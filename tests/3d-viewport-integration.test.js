"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const runtime = read("app/3d/scene-runtime.js");
const viewport = read("app/3d/three-scene-renderer.js");

assert.match(runtime, /app\/3d\/three-scene-renderer\.js/, "3D runtime must load the visible viewport presenter.");
assert.match(runtime, /loadViewportRenderer/, "3D runtime must expose a viewport loader boundary.");

assert.match(viewport, /servoforge\.3d-viewport\.v0\.1/, "Viewport must publish its v0.1 identity.");
assert.match(viewport, /0\.185\.1/, "Three.js must remain pinned for deterministic staging behavior.");
assert.match(viewport, /cdn\.jsdelivr\.net\/npm\/three@/, "Three.js must load from the pinned CDN module path.");
assert.match(viewport, /Labeler3DSceneRuntime/, "Viewport must consume the read-only 3D runtime.");
assert.match(viewport, /\.snapshot\(/, "Viewport animation must consume runtime snapshots.");
assert.match(viewport, /new THREE\.WebGLRenderer/, "Viewport must use the Three.js WebGL renderer.");
assert.match(viewport, /new THREE\.PerspectiveCamera/, "Viewport must expose a perspective 3D camera.");
assert.match(viewport, /new THREE\.LatheGeometry/, "v0.1 must include a physical bottle mesh rather than only debug primitives.");
assert.match(viewport, /servoPlateRotationY/, "Servo plate rendering must consume the shared scene rotation datum.");
assert.match(viewport, /requestAnimationFrame/, "Viewport must track live ServoForge preview motion.");
assert.match(viewport, /textContent = "3D View"/);
assert.match(viewport, /Drag to orbit • Wheel to zoom/);
assert.match(viewport, /Generated Servo Program • read only/);

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

console.log("ServoForge visible 3D viewport boundary regression passed.");
