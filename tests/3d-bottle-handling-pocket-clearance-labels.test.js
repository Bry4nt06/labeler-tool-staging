"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.resolve(__dirname, "../app/3d/bottle-handling-viewport-integration.js"), "utf8");

test("integrated starwheel pockets follow active bottle diameter plus 3 mm clearance", () => {
  assert.match(source, /const POCKET_DIAMETRAL_CLEARANCE_MM = 3/);
  assert.match(source, /bottleDiameterMm\(snapshot\) \+ POCKET_DIAMETRAL_CLEARANCE_MM/);
  assert.match(source, /true-circular-bottle-clearance-arc/);
  assert.match(source, /radialClearanceMm/);
});

test("pocket geometry stays inside the single handling viewport", () => {
  assert.match(source, /ServoForgeBottleHandlingSystem/);
  assert.match(source, /independentAnimationLoop: false/);
  assert.match(source, /prototypeSceneHook: false/);
});
