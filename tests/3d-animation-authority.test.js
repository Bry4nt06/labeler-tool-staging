"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const integration = fs.readFileSync(path.join(root, "app/3d/animation-authority-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");

const indexOf = (needle) => bootstrap.indexOf(`\"${needle}\"`);

test("3D animation uses current viewport as visual authority", () => {
  assert.match(integration, /visualAuthority: "current-servoforge-3d-hardware-render"/);
  assert.match(integration, /motionAuthority: "existing-preview-animation-clock-and-servo-program"/);
  assert.match(integration, /global\.Labeler3DViewport\?\.open/);
  assert.match(integration, /Open 3D Animation/);
});

test("3D animation authority loads after scene and animation runtimes", () => {
  const scene = indexOf("app/3d/scene-runtime.js");
  const animation = indexOf("app/animation-runtime.js");
  const authority = indexOf("app/3d/animation-authority-integration.js");
  assert.ok(scene >= 0, "scene runtime must be bootstrapped");
  assert.ok(animation >= 0, "animation runtime must be bootstrapped");
  assert.ok(authority >= 0, "3D animation authority must be bootstrapped");
  assert.ok(scene < authority, "scene runtime must load before 3D animation authority");
  assert.ok(animation < authority, "animation clock must load before 3D animation authority");
});
