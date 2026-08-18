"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/spender-knuckle-linkage-refinement-integration.js");

const correctionIndex = bootstrap.indexOf("app/3d/spender-knuckle-correction-integration.js");
const refinementIndex = bootstrap.indexOf("app/3d/spender-knuckle-linkage-refinement-integration.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
assert.ok(correctionIndex >= 0, "Initial spender knuckle correction must load.");
assert.ok(refinementIndex > correctionIndex, "Closeup linkage refinement must load after the initial correction.");
assert.ok(equipmentIndex > refinementIndex, "Equipment layout must consume the refined spender factory.");

assert.match(source, /servoforge\.3d-hardware-mesh\.v7-spender-photo-linkage/);
assert.match(source, /user-supplied-spender-linkage-closeups-2026-08-18/);
assert.match(source, /ServoForgeSpenderBackbone/);
assert.match(source, /ServoForgeSpenderPlateMountBlade/);
assert.match(source, /ServoForgeKronesWedgeInfeedHousing/);
assert.match(source, /ServoForgeKronesWedgeClampingPlate/);
assert.match(source, /ServoForgeSpenderAngleAdjustmentKnuckle/);
assert.match(source, /upstreamPivotX = number\(plate\.position\.x, 0\) - plateLength \* 0\.38/);
assert.match(source, /blackLinkEnd = \{ x: blackLinkLength/);
assert.match(source, /ServoForgeSpenderRefinedRedPivotDial/);
assert.match(source, /ServoForgeSpenderRefinedMainArmLink/);
assert.match(source, /ServoForgeSpenderRefinedBlackAdjustmentLink/);
assert.match(source, /ServoForgeSpenderRefinedHingeFork/);
assert.match(source, /ServoForgeSpenderRefinedHingePin/);
assert.match(source, /ServoForgeSpenderRefinedPlateAdjustmentArm/);
assert.match(source, /ServoForgeSpenderPlateSupportEar/);
assert.match(source, /ServoForgeSpenderRefinedPlateMountPin/);
assert.match(source, /pivotLocation:\s*"upstream-end-of-wedge"/);
assert.match(source, /blackLinkDirection:\s*"downstream-positive-X"/);
assert.match(source, /plateSupportDirection:\s*"downstream-positive-X"/);
assert.match(source, /connectedToRadialApplicationArm:\s*true/);
assert.match(source, /connectedToPlateAdjustmentArm:\s*true/);
assert.match(source, /backsideOpen:\s*true/);
assert.match(source, /approvedPlacementPreserved:\s*true/);
assert.match(source, /bottleClearanceMm:\s*number\(aggregateItem\?\.applicationClearanceMm, 2\)/);
assert.match(source, /flowAligned:\s*true/);
assert.match(source, /adjustmentLogicAuthority:\s*false/);
assert.match(source, /dimensionalAuthority:\s*false/);

[
  /saveCurrentSettings\s*\(/,
  /state\.program\s*=/,
  /setServoAngleOverride\s*\(/,
  /simulation\.lines\s*=/
].forEach((pattern) => assert.doesNotMatch(source, pattern, `Spender linkage refinement must remain read-only: ${pattern}`));

console.log("ServoForge 3D spender linkage refinement regression passed.");
