"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const hotfixPath = path.join(root, "app", "wipe-side-servo-parity-v119.js");
const appPath = path.join(root, "app.js");
const bootstrapPath = path.join(root, "app", "bootstrap.js");
const manifestPath = path.join(root, "update-manifest.json");
const mapPath = path.join(root, "config", "default-programs", "map-apl-6-aggregate.json");

const source = fs.readFileSync(hotfixPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const aplMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const build = "wipe-side-servo-parity-v119-20260814-2302";

assert.doesNotThrow(() => new vm.Script(source, { filename: hotfixPath }));

let progressiveDirection = null;
const context = {
  console,
  state: {
    direction: "ccw",
    applicationMode: "APL",
    depths: { wipeInner: 16, wipeOuter: 17, nonOpRoller: -18 },
    buildInputs: { neckApplication: "Center", neckContactMm: 0, bodyContactMm: 5, backContactMm: 5 }
  },
  document: {
    getElementById(id) {
      return id === "mapDirection" ? { value: "ccw" } : null;
    },
    querySelector() { return null; }
  },
  activeMachineMap() {
    return { machineSettings: { direction: "ccw" } };
  },
  LabelerCoderOrientationDriver: {
    physicalDirection: (stored) => stored === "cw" ? "ccw" : "cw",
    servoDirectionSign: (stored) => stored === "cw" ? -1 : 1
  },
  LabelerWipeTelemetryService: {
    physicalWipeMachineDirection: (stored) => stored === "cw" ? "ccw" : "cw",
    contactedLabelCoverage(program, section, station, throughTableAngle, visual) {
      if (visual?.tackMode === "center") return { percentage: 50, leftPercent: 100, rightPercent: 0 };
      return { percentage: 50, leftPercent: 100, rightPercent: 0 };
    },
    wipeDownTelemetry() {
      return { tackMode: "center", percentage: 50, leftPercent: 100, rightPercent: 0 };
    }
  },
  LabelerProgressiveLabelFill: {
    wipeApplicationReference: (section) => section === "neck" ? "center-tack" : "leading-edge"
  },
  updateBottleLabelProgress() {
    progressiveDirection = context.state.direction;
    const visual = { tackMode: "center" };
    return context.LabelerWipeTelemetryService.contactedLabelCoverage([], "neck", 1, 0, visual);
  },
  SERVOFORGE_RELEASE_VERSION: "0.9.10"
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: hotfixPath });

assert.equal(aplMap.machineSettings.direction, "ccw", "APL 6-Aggregate fixture must retain stored ccw servo coordinates");
assert.equal(context.state.depths.wipeInner, -16, "Inside wipe-down pad depth must remain signed inward");
assert.equal(context.state.depths.nonOpRoller, -18, "Inside roller depth must remain independent");

const api = context.ServoForgeWipeSideServoParityV119;
assert.equal(api.servoCoordinateVisualSign("ccw"), 1, "stored ccw must use +1 servo visual sign");
assert.equal(api.servoCoordinateVisualSign("cw"), -1, "stored cw must use -1 servo visual sign");
assert.equal(api.servoWipeVisualSideForPlateTravel(10, "ccw"), "left", "positive ccw plate travel must wipe the servo-coordinate left side");
assert.equal(api.servoWipeVisualSideForPlateTravel(-10, "ccw"), "right", "negative ccw plate travel must wipe the servo-coordinate right side");

const centerCoverage = context.LabelerWipeTelemetryService.contactedLabelCoverage([], "neck", 1, 0, { tackMode: "center" });
assert.equal(centerCoverage.leftPercent, 0, "center-tack visual must retire the old physical-direction left side");
assert.equal(centerCoverage.rightPercent, 100, "center-tack visual must follow the servo-coordinate side");

const leadingCoverage = context.LabelerWipeTelemetryService.contactedLabelCoverage([], "body", 3, 0, { tackMode: "leading" });
assert.equal(leadingCoverage.leftPercent, 100, "leading-edge coverage must keep physical direction semantics");
assert.equal(leadingCoverage.rightPercent, 0, "leading-edge coverage must not be center-tack swapped");

const panelTelemetry = context.LabelerWipeTelemetryService.wipeDownTelemetry();
assert.equal(panelTelemetry.leftPercent, 0, "Wipe-Down telemetry panel must use the same corrected center-tack side");
assert.equal(panelTelemetry.rightPercent, 100, "Wipe-Down telemetry panel must agree with bottle label fill");

context.updateBottleLabelProgress({}, 0, []);
assert.equal(progressiveDirection, "cw", "leading-edge presentation may temporarily use the physical machine direction");
assert.equal(context.state.direction, "ccw", "stored servo direction must be restored after progressive rendering");

assert.doesNotMatch(source, /correctBottleTransforms/, "v119 must not post-process the correct bottle transform");
assert.ok(app.includes(`const build = "${build}"`), "app startup must carry v119 build id");
assert.ok(app.includes("app/wipe-side-servo-parity-v119.js"), "app startup must load v119");
assert.ok(!app.includes("app/wipe-inner-servo-coordinate-parity-v118.js"), "v118 runtime hotfix must no longer load");
assert.ok(bootstrap.includes(`const build = "${build}"`), "bootstrap must use the v119 cache identity");
assert.equal(manifest.buildId, build, "update manifest must advertise v119");

console.log("Wipe-side servo parity v119 regression passed.");
