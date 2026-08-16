"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/physical-wipe-direction-v125.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source, { filename: "physical-wipe-direction-v125.js" }));

function makeContext(storedDirection) {
  const context = {
    console,
    state: { direction: storedDirection },
    document: {
      getElementById(id) { return id === "mapDirection" ? { value: storedDirection } : null; },
      querySelector() { return null; }
    },
    activeMachineMap() { return { machineSettings: { direction: storedDirection } }; },
    LabelerCoderOrientationDriver: {
      physicalDirection(stored) { return stored === "cw" ? "ccw" : "cw"; }
    },
    LabelerWipeTelemetryService: {
      centerTackServoSideParityV119: true,
      physicalWipeMachineDirection(stored) { return stored === "cw" ? "ccw" : "cw"; },
      contactedLabelCoverage(program, section, station, throughTableAngle, visual) {
        if (visual?.tackMode !== "center") return { percentage: 50, leftPercent: 30, rightPercent: 70 };
        // v119's legacy servo-coordinate result is opposite the physical machine result.
        return storedDirection === "ccw"
          ? { percentage: 50, leftPercent: 100, rightPercent: 0 }
          : { percentage: 50, leftPercent: 0, rightPercent: 100 };
      },
      wipeDownTelemetry() {
        return storedDirection === "ccw"
          ? { tackMode: "center", percentage: 50, leftPercent: 100, rightPercent: 0 }
          : { tackMode: "center", percentage: 50, leftPercent: 0, rightPercent: 100 };
      }
    },
    LabelerProgressiveLabelFill: { centerTackServoSideParityV119: true },
    SERVOFORGE_RELEASE_VERSION: "0.9.10"
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "physical-wipe-direction-v125.js" });
  return context;
}

const cwMachine = makeContext("ccw"); // legacy stored ccw = physical CW
assert.equal(cwMachine.ServoForgePhysicalWipeDirectionV125.physicalMachineDirection(), "cw");
assert.equal(cwMachine.ServoForgePhysicalWipeDirectionV125.physicalWipeVisualSideForPlateTravel(10), "right");
let coverage = cwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "neck", 1, 0, { tackMode: "center" });
assert.equal(coverage.leftPercent, 0, "physical CW must not keep v119's mirrored left-side center coverage");
assert.equal(coverage.rightPercent, 100, "physical CW center wipe must progress on the physical right side for positive plate travel");
let panel = cwMachine.LabelerWipeTelemetryService.wipeDownTelemetry();
assert.equal(panel.leftPercent, 0);
assert.equal(panel.rightPercent, 100);

const ccwMachine = makeContext("cw"); // legacy stored cw = physical CCW
assert.equal(ccwMachine.ServoForgePhysicalWipeDirectionV125.physicalMachineDirection(), "ccw");
assert.equal(ccwMachine.ServoForgePhysicalWipeDirectionV125.physicalWipeVisualSideForPlateTravel(10), "left");
coverage = ccwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "neck", 1, 0, { tackMode: "center" });
assert.equal(coverage.leftPercent, 100, "physical CCW must mirror the physical CW wipe side");
assert.equal(coverage.rightPercent, 0);
panel = ccwMachine.LabelerWipeTelemetryService.wipeDownTelemetry();
assert.equal(panel.leftPercent, 100);
assert.equal(panel.rightPercent, 0);

const leading = cwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "body", 3, 0, { tackMode: "leading" });
assert.equal(leading.leftPercent, 30, "v125 must not alter leading-edge coverage that already uses physical semantics");
assert.equal(leading.rightPercent, 70);

assert.equal(cwMachine.LabelerWipeTelemetryService.centerTackServoSideParityV119, false);
assert.equal(cwMachine.LabelerWipeTelemetryService.physicalCenterWipeDirectionV125, true);
assert.doesNotMatch(source, /correctBottleTransforms|bottleVisualServoSign|servoCoordinateVisualSign/, "v125 must not change bottle orientation transforms");

console.log("Physical wipe direction v125 regression passed.");
