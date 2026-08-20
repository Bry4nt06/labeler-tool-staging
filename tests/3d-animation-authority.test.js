"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const integration = fs.readFileSync(path.join(root, "app/3d/animation-authority-integration.js"), "utf8");
const animationRuntime = fs.readFileSync(path.join(root, "app/animation-runtime.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");

const bootstrapIndex = (needle) => bootstrap.indexOf(`\"${needle}\"`);

test("3D animation uses current viewport as visual authority", () => {
  assert.match(integration, /visualAuthority: "current-servoforge-3d-hardware-render"/);
  assert.match(integration, /motionAuthority: "existing-preview-animation-clock-and-servo-program"/);
  assert.match(integration, /global\.Labeler3DViewport\?\.open/);
  assert.match(integration, /Open 3D Animation/);
});

test("animation clock loads the 3D animation authority after the scene runtime", () => {
  const scene = bootstrapIndex("app/3d/scene-runtime.js");
  const animation = bootstrapIndex("app/animation-runtime.js");
  assert.ok(scene >= 0, "scene runtime must be bootstrapped");
  assert.ok(animation >= 0, "animation runtime must be bootstrapped");
  assert.ok(scene < animation, "scene runtime must load before the animation clock");
  assert.match(animationRuntime, /app\/3d\/animation-authority-integration\.js/);
  assert.match(animationRuntime, /servoforge3dAnimationAuthority/);
});
