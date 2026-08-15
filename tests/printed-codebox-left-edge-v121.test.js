"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const driver = require("../drivers/profile/coder-orientation-driver.js");

const root = path.resolve(__dirname, "..");
const visualSource = fs.readFileSync(path.join(root, "app", "printed-codebox-left-edge-v121.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "app", "profile-generation.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
const V121_BUILD = "printed-codebox-left-edge-v121-20260814-2345";
const CURRENT_BUILD = "autocol-codebox-orientation-v122-20260815-0001";

assert.doesNotThrow(() => new vm.Script(visualSource, { filename: "printed-codebox-left-edge-v121.js" }));
assert.equal(driver.printedLabelLeftEdgeLocalAngle({ section: "body", labelWidthDeg: 100 }), 50);
assert.equal(driver.printedCodeBoxLocalAngle({ section: "body", labelWidthDeg: 100, codeBoxOffsetDeg: 15 }), 35);
assert.equal(driver.printedLabelLeftEdgeLocalAngle({ section: "back", labelWidthDeg: 100 }), 230);
assert.equal(driver.printedCodeBoxLocalAngle({ section: "back", labelWidthDeg: 100, codeBoxOffsetDeg: 15 }), 215);

const cw = driver.codeBoxTarget({
  section: "body",
  applicationTarget: 0,
  labelWidthDeg: 100,
  codeBoxOffsetDeg: 15,
  storedDirection: "ccw",
  currentPlateAngle: 0,
  coderSide: "outer"
});
const ccw = driver.codeBoxTarget({
  section: "body",
  applicationTarget: 0,
  labelWidthDeg: 100,
  codeBoxOffsetDeg: 15,
  storedDirection: "cw",
  currentPlateAngle: 0,
  coderSide: "outer"
});
assert.equal(cw.printedLabelLeftEdgeLocalAngle, 50);
assert.equal(ccw.printedLabelLeftEdgeLocalAngle, 50);
assert.equal(cw.printedCodeBoxLocalAngle, 35);
assert.equal(ccw.printedCodeBoxLocalAngle, 35);
assert.equal(cw.operatorFacingLeftEdge, true);
assert.equal(ccw.printedArtworkDirectionInvariant, true);
assert.notEqual(cw.target, ccw.target, "Only the servo coordinate should change with machine direction.");

assert.match(visualSource, /data-bottle-label-left-edge/);
assert.match(visualSource, /data-bottle-code-box-center/);
assert.match(visualSource, /#76f06a/);
assert.match(visualSource, /#ffd166/);
assert.match(visualSource, /printedLabelLeftEdgeLocalAngle/);
assert.match(visualSource, /printedCodeBoxLocalAngle/);
assert.match(visualSource, new RegExp(V121_BUILD));
assert.match(profileSource, /app\/autocol-coder-codebox-generation-v122\.js/);
assert.match(profileSource, new RegExp(CURRENT_BUILD));
assert.match(appSource, new RegExp(CURRENT_BUILD));
assert.match(appSource, /app\/printed-codebox-left-edge-v121\.js/);
assert.match(bootstrapSource, new RegExp(CURRENT_BUILD));
assert.equal(manifest.buildId, CURRENT_BUILD);
assert.match(manifest.notes, /v121/i);

console.log("Printed Code Box Ctr from operator-facing label left edge v121 regression passed.");
