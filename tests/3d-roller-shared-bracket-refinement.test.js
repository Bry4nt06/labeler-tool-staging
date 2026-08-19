"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/roller-shared-bracket-refinement-integration.js");

test("shared roller bracket refinement loads after neck contact correction", () => {
  const neckIndex = bootstrap.indexOf('"app/3d/neck-contact-coder-correction-integration.js"');
  const rollerIndex = bootstrap.indexOf('"app/3d/roller-shared-bracket-refinement-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(neckIndex >= 0);
  assert.ok(rollerIndex > neckIndex);
  assert.ok(runtimeIndex > rollerIndex);
});

test("roller bodies are 80 mm wide and mounting tubes are compact", () => {
  assert.match(source, /const ROLLER_WIDTH_MM = 80;/);
  assert.match(source, /const SHARED_RAIL_DIAMETER_MM = 14;/);
  assert.match(source, /const SHARED_POST_DIAMETER_MM = 12;/);
  assert.match(source, /const CARRIER_ARM_HEIGHT_MM = 10;/);
  assert.match(source, /const CARRIER_ARM_DEPTH_MM = 14;/);
  assert.match(source, /user-specified-80mm/);
});

test("active rollers share mounting hardware per side", () => {
  assert.match(source, /groupId: `shared-roller-\$\{side\}`/);
  assert.match(source, /sharedBracketPerSide: true/);
  assert.match(source, /one-bracket-per-active-side-group/);
  assert.match(source, /if \(!mount\?\.isMaster/);
});

test("outside roller hardware is radially outside the labeler", () => {
  assert.match(source, /const OUTER_MOUNT_OUTSET_MM = 125;/);
  assert.match(source, /signedOffsetMm = side === "inner" \? -INNER_MOUNT_INSET_MM : OUTER_MOUNT_OUTSET_MM/);
  assert.match(source, /outsideHardwareRadiallyOutward: side === "outer"/);
  assert.match(source, /hardware-outside-labeler/);
});

test("carrier brackets use carousel-center radial alignment", () => {
  assert.match(source, /threePointRadialAlignment = true/);
  assert.match(source, /carousel-center-to-bottle-plate-center-to-bracket-center-radial-line/);
  assert.match(source, /carousel-center-bottle-plate-center-bracket-center/);
});

test("roller refinement remains read-only", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
