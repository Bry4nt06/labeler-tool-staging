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
        // v119 resolves the servo-coordinate center-tack wing. For Neck that is
        // intentionally the opposite wing from the arrow/loading side.
        return storedDirection === "ccw"
          ? { percentage: 50, leftPercent: 100, rightPercent: 0 }
          : { percentage: 50, leftPercent: 0, rightPercent: 100 };
      },
      wipeDownTelemetry() {
        return storedDirection === "ccw"
          ? { section: "neck", tackMode: "center", percentage: 50, leftPercent: 100, rightPercent: 0 }
          : { section: "neck", tackMode: "center", percentage: 50, leftPercent: 0, rightPercent: 100 };
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
assert.equal(coverage.leftPercent, 100, "physical CW Neck center tack must wipe the wing opposite the right-side arrow/loading direction");
assert.equal(coverage.rightPercent, 0, "the Neck arrow/loading side must remain unwiped during the center-tack turn");
let panel = cwMachine.LabelerWipeTelemetryService.wipeDownTelemetry();
assert.equal(panel.leftPercent, 100, "Wipe-Down telemetry must show the opposite Neck wing");
assert.equal(panel.rightPercent, 0);

// Body/Back center-tack presentation keeps the existing v125 physical-direction behavior.
coverage = cwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "body", 3, 0, { tackMode: "center" });
assert.equal(coverage.leftPercent, 0, "Body center tack must retain the current physical-direction correction");
assert.equal(coverage.rightPercent, 100);
coverage = cwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "back", 5, 0, { tackMode: "center" });
assert.equal(coverage.leftPercent, 0, "Back center tack must retain the current physical-direction correction");
assert.equal(coverage.rightPercent, 100);

const ccwMachine = makeContext("cw"); // legacy stored cw = physical CCW
assert.equal(ccwMachine.ServoForgePhysicalWipeDirectionV125.physicalMachineDirection(), "ccw");
assert.equal(ccwMachine.ServoForgePhysicalWipeDirectionV125.physicalWipeVisualSideForPlateTravel(10), "left");
coverage = ccwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "neck", 1, 0, { tackMode: "center" });
assert.equal(coverage.leftPercent, 0, "physical CCW Neck center tack must mirror the physical CW opposite-wing behavior");
assert.equal(coverage.rightPercent, 100);
panel = ccwMachine.LabelerWipeTelemetryService.wipeDownTelemetry();
assert.equal(panel.leftPercent, 0);
assert.equal(panel.rightPercent, 100);

coverage = ccwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "body", 3, 0, { tackMode: "center" });
assert.equal(coverage.leftPercent, 100, "Body center tack must remain mirrored with physical machine direction");
assert.equal(coverage.rightPercent, 0);

const leading = cwMachine.LabelerWipeTelemetryService.contactedLabelCoverage([], "body", 3, 0, { tackMode: "leading" });
assert.equal(leading.leftPercent, 30, "v129 must not alter leading-edge coverage that already uses physical semantics");
assert.equal(leading.rightPercent, 70);

assert.equal(cwMachine.LabelerWipeTelemetryService.centerTackServoSideParityV119, false);
assert.equal(cwMachine.LabelerWipeTelemetryService.physicalCenterWipeDirectionV125, true);
assert.equal(cwMachine.LabelerWipeTelemetryService.neckCenterTackOppositeHalfV129, true);
assert.equal(cwMachine.ServoForgePhysicalWipeDirectionV125.neckCenterTackOppositeHalfV129, true);
assert.doesNotMatch(source, /correctBottleTransforms|bottleVisualServoSign|servoCoordinateVisualSign/, "v129 must not change bottle orientation transforms");

console.log("Physical wipe direction with Neck center-tack opposite-half regression passed.");
