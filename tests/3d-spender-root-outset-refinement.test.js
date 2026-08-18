"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/spender-root-outset-refinement-integration.js");

test("root-outset refinement loads after the base spender engagement layer", () => {
  const baseIndex = bootstrap.indexOf('"app/3d/spender-engagement-wipe-bevel-integration.js"');
  const refinementIndex = bootstrap.indexOf('"app/3d/spender-root-outset-refinement-integration.js"');
  const handlingIndex = bootstrap.indexOf('"app/3d/bottle-handling-adapter.js"');
  assert.ok(baseIndex >= 0);
  assert.ok(refinementIndex > baseIndex);
  assert.ok(handlingIndex > refinementIndex);
});

test("spender root moves an additional 7 mm outward while downstream position is preserved", () => {
  assert.match(source, /const ADDITIONAL_ROOT_OUTSET_MM = 7;/);
  assert.match(source, /const ADDITIONAL_DOWNSTREAM_OFFSET_MM = 0;/);
  assert.match(source, /const ADDITIONAL_CENTER_OUTSET_MM = \(ADDITIONAL_ROOT_OUTSET_MM \+ ADDITIONAL_DOWNSTREAM_OFFSET_MM\) \/ 2;/);
  assert.match(source, /TOTAL_ROOT_OUTSET_MM/);
  assert.match(source, /TOTAL_DOWNSTREAM_INSET_MM/);
  assert.match(source, /pivot\.rotation\.y \+= outwardSign \* additionalAngleRadians/);
  assert.match(source, /pivot\.position\.z \+= outwardSign \* centerOutsetWorld/);
  assert.match(source, /downstreamPositionPreserved: true/);
  assert.match(source, /user-requested-9mm-total-root-outset-2mm-downstream-inset/);
});

test("refinement remains 3D presentation-only", () => {
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});
