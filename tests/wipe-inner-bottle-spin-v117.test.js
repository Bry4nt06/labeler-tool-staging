"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const hotfixPath = path.join(root, "app", "wipe-inner-bottle-spin-hotfix-v117.js");
const appPath = path.join(root, "app.js");
const bootstrapPath = path.join(root, "app", "bootstrap.js");
const manifestPath = path.join(root, "update-manifest.json");
const source = fs.readFileSync(hotfixPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const bootstrap = fs.readFileSync(bootstrapPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const build = "wipe-inner-bottle-spin-v117-20260814-2235";

assert.doesNotThrow(() => new vm.Script(source, { filename: hotfixPath }));

let progressiveDirection = null;
const bottleNode = {
  attrs: { "data-animation-head": "1" },
  getAttribute(name) { return this.attrs[name] || ""; },
  setAttribute(name, value) { this.attrs[name] = String(value); }
};
const svg = {
  querySelectorAll(selector) {
    return selector === "[data-animation-head]" ? [bottleNode] : [];
  }
};

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
    buildInputs: {
      bodyContactMm: 5
    }
  },
  LabelerCoderOrientationDriver: {
    physicalDirection: (stored) => stored === "cw" ? "ccw" : "cw"
  },
  LabelerWipeTelemetryService: {
    liveWipeMachineDirection: () => "cw",
    physicalWipeMachineDirection: (stored) => stored === "cw" ? "ccw" : "cw"
  },
  LabelerProgressiveLabelFill: {
    wipeApplicationReference: () => "leading-edge"
  },
  updateBottleLabelProgress() {
    progressiveDirection = context.state.direction;
  },
  heads() {
    return [{ head: 1, tableAngle: 10, x: 11, y: 22 }];
  },
  bottlePreviewAngle() {
    return 45;
  },
  angleToSvgRotation() {
    return 90;
  },
  SERVOFORGE_RELEASE_VERSION: "0.9.10"
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: hotfixPath });

assert.equal(context.state.depths.wipeInner, -16, "APL Inside wipe depth must stay signed inward from the bottle-table radius");
assert.equal(context.state.depths.nonOpRoller, -18, "Inside roller depth must remain independent and unchanged");
assert.equal(context.ServoForgeWipeInnerBottleSpinHotfix.bottleVisualServoSign("cw"), -1, "Physical CW must render positive servo travel counter-clockwise in the SVG bottle-local frame");
assert.equal(context.ServoForgeWipeInnerBottleSpinHotfix.bottleVisualServoSign("ccw"), 1, "Physical CCW must render positive servo travel clockwise in the SVG bottle-local frame");

context.updateBottleLabelProgress({}, 0, []);
assert.equal(progressiveDirection, "cw", "progressive wipe rendering must execute in the physical machine-direction frame");
assert.equal(context.state.direction, "ccw", "stored direction token must be restored after wipe-progress rendering");

context.ServoForgeWipeInnerBottleSpinHotfix.correctBottleTransforms(svg, []);
assert.equal(bottleNode.attrs.transform, "translate(11 22) rotate(45)", "Bottle visual must use physical CW sign: radial 90° minus 45° servo travel");
assert.equal(bottleNode.attrs["data-bottle-spin-direction"], "cw");
assert.equal(bottleNode.attrs["data-bottle-servo-visual-sign"], "-1");

assert.ok(app.includes(`const build = "${build}"`), "app startup must carry the v117 build id");
assert.ok(app.includes("app/wipe-inner-bottle-spin-hotfix-v117.js"), "app startup must load the v117 hotfix");
assert.ok(!app.includes("app/wipe-direction-inner-radius-hotfix-v116.js"), "v116 outward-radius hotfix must no longer load");
assert.ok(bootstrap.includes(`const build = "${build}"`), "bootstrap metadata must carry v117");
assert.equal(manifest.buildId, build, "update manifest must advertise v117");

console.log("Wipe inner radius and physical bottle spin v117 regression passed.");
