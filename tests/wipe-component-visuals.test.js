"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const assemblies = read("app/assembly-map-renderer.js");
const bevelCorrection = read("app/wipe-pad-bevel-direction-integration.js");
const bootstrap = read("app/bootstrap.js");
const mechanical = read("app/mechanical-map-scene-renderer.js");
const simulation = read("app/simulation-map-scene-renderer.js");

assert.doesNotThrow(() => new vm.Script(assemblies, { filename: "assembly-map-renderer.js" }));
assert.doesNotThrow(() => new vm.Script(bevelCorrection, { filename: "wipe-pad-bevel-direction-integration.js" }));
assert.doesNotThrow(() => new vm.Script(mechanical, { filename: "mechanical-map-scene-renderer.js" }));

assert.match(assemblies, /WIPE_DOWN_PAD_WIDTH_MM = 22/);
assert.match(assemblies, /servoforge-wipe-sponge-pattern/);
assert.match(assemblies, /#ee7418/i);
assert.match(assemblies, /data-pad-width-mm/);
assert.match(assemblies, /drawSpongeWipeDownPad\(add, objectLayer, item, centerRadius\)/);

assert.match(bevelCorrection, /machineTrailingPadPath/);
assert.match(bevelCorrection, /innerTrailingStart = start \+ bevelDeg/);
assert.match(bevelCorrection, /data-bevel-facing/);
assert.match(bevelCorrection, /against-machine-direction/);
assert.match(bevelCorrection, /bevelAgainstMachineDirectionV1: true/);
assert.match(bootstrap, /wipe-pad-bevel-direction-integration\.js/);
assert.match(bootstrap, /wipe-pad-reverse-bevel-v34-20260807-1343/);

assert.match(assemblies, /servoforge-roller-sponge-pattern/);
assert.match(assemblies, /#969da4/i);
assert.match(assemblies, /r: 4\.2/);
assert.match(assemblies, /fill: "#111417"/i);
assert.match(assemblies, /data-roller-hub/);
assert.match(assemblies, /drawSpongeRoller\(add, objectLayer/);

assert.match(mechanical, /drawSpongeRoller\(add, equipmentLayer/);
assert.match(simulation, /drawConfiguredAssemblies\(add, configuredAssemblyLayer\)/);

const testState = {
  radius: 250,
  referencePitchRadiusMm: 572.958,
  tablePitchRadiusMm: 572.958,
  direction: "ccw"
};
const context = {
  console,
  state: testState,
  num(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  },
  angleToXY(angle, radius) {
    const signed = testState.direction === "cw" ? -1 : 1;
    const rad = signed * Number(angle) * Math.PI / 180;
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
  },
  Object
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(assemblies, context, { filename: "assembly-map-renderer.js" });
vm.runInContext(bevelCorrection, context, { filename: "wipe-pad-bevel-direction-integration.js" });

const renderer = context.LabelerWipeComponentVisualRenderer;
assert.equal(renderer.WIPE_DOWN_PAD_WIDTH_MM, 22);
assert.equal(renderer.bevelAgainstMachineDirectionV1, true);
const expectedWidth = 22 * 250 / 572.958;
assert.ok(Math.abs(renderer.wipeDownPadWidthMapUnits() - expectedWidth) < 1e-9, "Pad width must scale from the physical 22 mm width.");

const pathD = renderer.machineTrailingPadPath(149, 169, 266, renderer.wipeDownPadWidthMapUnits());
assert.match(pathD, /^M /);
assert.match(pathD, / A /);
assert.match(pathD, / L /);
assert.match(pathD, / Z$/);

testState.direction = "cw";
const clockwisePath = renderer.machineTrailingPadPath(149, 169, 266, renderer.wipeDownPadWidthMapUnits());
assert.notEqual(clockwisePath, pathD, "CW and CCW maps must mirror the physical pad while keeping the bevel against travel.");

console.log("Sponge wipe-down pad and roller visual regression passed with bevel against machine direction.");
