"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/spender-manual-assembly-integration.js");
const partsReference = read("app/3d/topmodul-parts-reference.js");

const placementIndex = bootstrap.indexOf("app/3d/spender-plate-placement-integration.js");
const manualIndex = bootstrap.indexOf("app/3d/spender-manual-assembly-integration.js");
const equipmentIndex = bootstrap.indexOf("app/3d/equipment-layout-adapter.js");
assert.ok(placementIndex >= 0, "Spender placement layer must load.");
assert.ok(manualIndex > placementIndex, "Manual spender refinement must load after approved placement geometry.");
assert.ok(equipmentIndex > manualIndex, "Equipment layout must consume the final manual-backed spender factory.");

assert.match(source, /servoforge\.3d-hardware-mesh\.v4-topmodul-manual-spender/);
assert.match(source, /ServoForgeKronesLabelApplicatorHead/);
assert.match(source, /ServoForgeKronesABLabelApplicationArm/);
assert.match(source, /ServoForgeKronesApplicationWedge/);
assert.match(source, /ServoForgeKronesGuideRollerAssembly/);
assert.match(source, /ServoForgeKronesLabelWebPath/);
assert.match(source, /ServoForgeKronesWedgeInfeedHousing/);
assert.match(source, /ServoForgeKronesWedgeGuidePlate/);
assert.match(source, /ServoForgeKronesWedgeClampingPlate/);
assert.match(source, /ServoForgeKronesSprocketIdlerL119/);
assert.match(source, /ServoForgeKronesWedgeBearing61800/);
assert.match(source, /ServoForgeKronesWedgeKnurledAdjustment/);
assert.match(source, /ServoForgeKronesABArmSection/);
assert.match(source, /ServoForgeKronesABArmMeasuringTape/);
assert.match(source, /ServoForgeKronesABStopPESensorAssembly/);

[
  "0-900-571-103",
  "0-900-588-044",
  "0-900-585-924",
  "0-900-67-556-7",
  "9-100-80-501-2",
  "0-900-01-112-0",
  "0-900-49-585-7",
  "0-900-58-560-3",
  "0-900-58-552-6"
].forEach((partNumber) => assert.ok(source.includes(partNumber), `Manual-backed spender source must retain ${partNumber}.`));

assert.match(partsReference, /LABEL APPLICATOR HEAD/);
assert.match(partsReference, /AB LABEL APPLICATION ARM/);
assert.match(partsReference, /APPLICATION WEDGE/);
assert.match(source, /dimensionsAutomaticallyAuthoritative:\s*false/);
assert.match(source, /placementRulesPreserved:\s*true/);
assert.match(source, /bottleClearanceMm:\s*number\(aggregateItem\?\.applicationClearanceMm, 2\)/);
assert.match(source, /flowAligned:\s*true/);

[
  /saveCurrentSettings\s*\(/,
  /state\.program\s*=/,
  /setServoAngleOverride\s*\(/,
  /simulation\.lines\s*=/
].forEach((pattern) => assert.doesNotMatch(source, pattern, `Manual spender presentation must remain read-only: ${pattern}`));

console.log("ServoForge TopModul manual-backed spender assembly regression passed.");
