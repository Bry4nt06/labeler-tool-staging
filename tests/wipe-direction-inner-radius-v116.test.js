"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const hotfixPath = path.join(root, "app/wipe-direction-inner-radius-hotfix-v116.js");
const appPath = path.join(root, "app.js");
const manifestPath = path.join(root, "update-manifest.json");
const source = fs.readFileSync(hotfixPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const build = "wipe-direction-inner-radius-v116-20260814-1800";

let renderedInsideDepth = null;
let progressiveDirection = null;
const context = {
  console,
  state: {
    direction: "cw",
    applicationMode: "APL",
    depths: {
      wipeInner: -16,
      wipeOuter: 17,
      nonOpRoller: -16
    },
    buildInputs: {
      bodyContactMm: 5
    }
  },
  LabelerWipeTelemetryService: {
    liveWipeMachineDirection: () => "ccw",
    physicalWipeMachineDirection: (stored) => stored === "cw" ? "ccw" : "cw"
  },
  LabelerProgressiveLabelFill: {
    wipeApplicationReference: () => "leading-edge"
  },
  drawConfiguredAssemblies() {
    renderedInsideDepth = context.state.depths.wipeInner;
  },
  updateBottleLabelProgress() {
    progressiveDirection = context.state.direction;
  },
  SERVOFORGE_RELEASE_VERSION: "0.9.10"
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: hotfixPath });

const visual = context.wipeVisualApplication("body", 100);
assert.equal(visual.direction, "rtl", "stored CW must present as physical CCW / right-to-left wipe");
assert.equal(visual.tackMode, "leading");

context.drawConfiguredAssemblies();
assert.equal(renderedInsideDepth, 16, "inside APL wipe pad depth must be outward from the table radius");
assert.equal(context.state.depths.wipeInner, 16, "legacy negative inside wipe depth should normalize to an outward magnitude");
assert.equal(context.state.depths.nonOpRoller, -16, "inside roller signed depth must remain untouched");

context.updateBottleLabelProgress({}, 0, []);
assert.equal(progressiveDirection, "ccw", "progressive label fill must run in the physical machine-direction frame");
assert.equal(context.state.direction, "cw", "stored machine-direction token must be restored after progressive rendering");

assert.ok(app.includes(`const build = "${build}"`), "app bootstrap loader must carry the v116 build id");
assert.ok(app.includes("app/wipe-direction-inner-radius-hotfix-v116.js"), "app startup must load the v116 hotfix after integrations");
assert.equal(manifest.buildId, build, "update manifest must advertise the v116 build");

console.log("Wipe direction and inner radius v116 regression passed.");
