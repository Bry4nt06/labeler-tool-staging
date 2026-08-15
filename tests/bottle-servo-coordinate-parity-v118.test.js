"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const hotfixPath = path.join(root, "app", "wipe-inner-servo-coordinate-parity-v118.js");
const appPath = path.join(root, "app.js");
const bootstrapPath = path.join(root, "app", "bootstrap.js");
const manifestPath = path.join(root, "update-manifest.json");
const mapPath = path.join(root, "config", "default-programs", "map-apl-6-aggregate.json");
const mapRendererPath = path.join(root, "app", "mechanical-map-scene-renderer.js");
const animationRendererPath = path.join(root, "app", "map-animation-renderer.js");
const simulationRendererPath = path.join(root, "app", "simulation-map-scene-renderer.js");

const source = fs.readFileSync(hotfixPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const aplMap = JSON.parse(fs.readFileSync(mapPath, "utf8"));
const mapRenderer = fs.readFileSync(mapRendererPath, "utf8");
const animationRenderer = fs.readFileSync(animationRendererPath, "utf8");
const simulationRenderer = fs.readFileSync(simulationRendererPath, "utf8");
const build = "bottle-servo-coordinate-parity-v118-20260814-2248";

assert.doesNotThrow(() => new vm.Script(source, { filename: hotfixPath }));

let progressiveDirection = null;
const context = {
  console,
  state: {
    direction: "ccw",
    applicationMode: "APL",
    depths: {
      wipeInner: 16,
      wipeOuter: 17,
      nonOpRoller: -18
    },
    buildInputs: { bodyContactMm: 5 }
  },
  LabelerCoderOrientationDriver: {
    physicalDirection: (stored) => stored === "cw" ? "ccw" : "cw",
    servoDirectionSign: (stored) => stored === "cw" ? -1 : 1
  },
  LabelerWipeTelemetryService: {
    physicalWipeMachineDirection: (stored) => stored === "cw" ? "ccw" : "cw"
  },
  LabelerProgressiveLabelFill: {
    wipeApplicationReference: () => "leading-edge"
  },
  updateBottleLabelProgress() {
    progressiveDirection = context.state.direction;
  },
  SERVOFORGE_RELEASE_VERSION: "0.9.10"
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: hotfixPath });

assert.equal(context.state.depths.wipeInner, -16, "APL Inside wipe depth must stay signed inward from the bottle-table radius");
assert.equal(context.state.depths.nonOpRoller, -18, "Inside roller depth remains independent");
assert.equal(aplMap.machineSettings.direction, "ccw", "APL 6-Aggregate fixture must retain the stored Clockwise-machine coordinate token");
assert.equal(context.ServoForgeWipeInnerServoCoordinateParityV118.servoCoordinateVisualSign("ccw"), 1,
  "APL 6-Aggregate stored ccw must render positive plate travel with the servo/coder +1 sign");
assert.equal(context.ServoForgeWipeInnerServoCoordinateParityV118.servoCoordinateVisualSign("cw"), -1,
  "Stored cw must use the matching servo/coder -1 sign");

context.updateBottleLabelProgress({}, 0, []);
assert.equal(progressiveDirection, "cw", "wipe-progress semantics may use the physical Clockwise direction");
assert.equal(context.state.direction, "ccw", "physical wipe presentation must restore the stored servo-coordinate token");

assert.doesNotMatch(source, /correctBottleTransforms/, "v118 must not post-process or mirror the core bottle transform");
for (const renderer of [mapRenderer, animationRenderer, simulationRenderer]) {
  assert.match(renderer, /servoSign = state\.direction === "cw" \? -1 : 1/,
    "all core bottle renderers must retain the servo-coordinate sign");
  assert.match(renderer, /angleToSvgRotation\(head\.tableAngle\) \+ servoSign \* padAngle/,
    "all core bottle renderers must use table frame plus commanded plate angle");
}

assert.ok(app.includes(`const build = "${build}"`), "app startup must carry the v118 build id");
assert.ok(app.includes("app/wipe-inner-servo-coordinate-parity-v118.js"), "app startup must load v118");
assert.ok(!app.includes("app/wipe-inner-bottle-spin-hotfix-v117.js"), "v117 physical bottle-transform override must no longer load");
assert.ok(bootstrap.includes(`const build = "${build}"`), "bootstrap metadata must carry v118");
assert.equal(manifest.buildId, build, "update manifest must advertise v118");

console.log("Bottle servo-coordinate parity v118 regression passed.");
