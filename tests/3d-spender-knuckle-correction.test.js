"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/spender-knuckle-correction-integration.js");

const manualIndex = bootstrap.indexOf("app/3d/spender-manual-assembly-integration.js");
const correctionIndex = bootstrap.indexOf("app/3d/spender-knuckle-correction-integration.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
assert.ok(manualIndex >= 0, "Manual-backed spender layer must be loaded.");
assert.ok(correctionIndex > manualIndex, "User-corrected spender layer must load after manual geometry.");
assert.ok(equipmentIndex > correctionIndex, "Equipment layout must consume the corrected spender factory.");

assert.match(source, /servoforge\.3d-hardware-mesh\.v6-spender-photo-knuckle/);
assert.match(source, /user-supplied-spender-knuckle-closeups-2026-08-18/);
assert.match(source, /ServoForgeKronesWedgeInfeedHousing/);
assert.match(source, /ServoForgeKronesWedgeKnurledAdjustment/);
assert.match(source, /removeNamed/);
assert.match(source, /ServoForgeSpenderAngleAdjustmentKnuckle/);
assert.match(source, /ServoForgeSpenderAngleKnuckleRedDial/);
assert.match(source, /ServoForgeSpenderAngleKnucklePivotWasher/);
assert.match(source, /ServoForgeSpenderAngleKnuckleCenterBolt/);
assert.match(source, /ServoForgeSpenderAngleKnuckleBlackLink/);
assert.match(source, /ServoForgeSpenderAngleKnuckleHingeFork/);
assert.match(source, /ServoForgeSpenderAngleKnuckleHingePin/);
assert.match(source, /ServoForgeSpenderPlateAdjustmentArm/);
assert.match(source, /ServoForgeSpenderPlateArmMount/);
assert.match(source, /ServoForgeSpenderMainArmKnuckleLink/);
assert.match(source, /ServoForgeSpenderMainArmKnuckleBolt/);
assert.match(source, /ServoForgeSpenderKnuckleAngleHandle/);
assert.match(source, /ServoForgeSpenderKnuckleHandleKnob/);
assert.match(source, /connectedToRadialApplicationArm:\s*true/);
assert.match(source, /connectedToPlateAdjustmentArm:\s*true/);
assert.match(source, /redPivotDialRendered:\s*true/);
assert.match(source, /blackAdjustmentLinkRendered:\s*true/);
assert.match(source, /pinnedHingeRendered:\s*true/);
assert.match(source, /removedBacksideBlock:\s*Boolean/);
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
].forEach((pattern) => assert.doesNotMatch(source, pattern, `Spender correction must remain read-only: ${pattern}`));

console.log("ServoForge 3D spender backside/photo-knuckle correction regression passed.");
