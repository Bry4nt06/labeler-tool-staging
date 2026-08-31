"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("app/3d/label-mesh-factory.js", "utf8");

test("3D label artwork UVs run in the readable outside-view direction", () => {
  assert.match(source, /const textureU0 = 1 - u0;/);
  assert.match(source, /const textureU1 = 1 - u1;/);
  assert.match(source, /\[textureU0, v0\], \[textureU1, v0\], \[textureU1, v1\]/);
  assert.match(source, /artworkOrientationAuthority: "outside-view-readable-u-reversed"/);
});

test("label artwork correction leaves physical wrap geometry unchanged", () => {
  assert.match(source, /const angle = centerRadians - wrapRadians \/ 2 \+ wrapRadians \* u;/);
  assert.match(source, /const y = bottom \+ \(top - bottom\) \* v;/);
});
