"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const driver = require("../drivers/translation/topmodul-rpc-angle-driver.js");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
test("legacy TopModul remains DTS4 while DTS3 gets a 45 degree RPC table domain", () => {
  assert.equal(driver.variant("TopModul"), "dts4");
  assert.equal(driver.variant("TopModul (DTS4)"), "dts4");
  assert.equal(driver.variant("TopModul (DTS3)"), "dts3");
  assert.equal(driver.fullRpcTableRotation("TopModul (DTS4)"), 360);
  assert.equal(driver.fullRpcTableRotation("TopModul (DTS3)"), 45);
});
test("DTS3 table angles scale linearly between physical and RPC coordinates", () => {
  assert.equal(driver.physicalToRpcTableAngle(0, "TopModul (DTS3)"), 0);
  assert.equal(driver.physicalToRpcTableAngle(90, "TopModul (DTS3)"), 11.25);
  assert.equal(driver.physicalToRpcTableAngle(180, "TopModul (DTS3)"), 22.5);
  assert.equal(driver.physicalToRpcTableAngle(270, "TopModul (DTS3)"), 33.75);
  assert.equal(driver.physicalToRpcTableAngle(360, "TopModul (DTS3)"), 45);
  assert.equal(driver.rpcToPhysicalTableAngle(45, "TopModul (DTS3)"), 360);
  assert.equal(driver.physicalToRpcTableAngle(450, "TopModul (DTS3)"), 56.25);
});
test("DTS4 and non-TopModul coordinates remain unchanged", () => {
  assert.equal(driver.physicalToRpcTableAngle(360, "TopModul (DTS4)"), 360);
  assert.equal(driver.physicalToRpcTableAngle(360, "TopModul"), 360);
  assert.equal(driver.physicalToRpcTableAngle(360, "Autocol"), 360);
  assert.equal(driver.displayDigits("TopModul (DTS3)"), 4);
  assert.equal(driver.displayDigits("TopModul (DTS4)"), 1);
});
test("machine builder exposes explicit DTS variants and RPC-facing outputs use the adapter", () => {
  const defaults = read("app/defaults.js");
  const controls = read("app/map-builder-controls.js");
  const renderer = read("app/servo-program-table-renderer.js");
  const events = read("app/controllers/servo-program-event-controller.js");
  const transfer = read("app/controllers/transfer-controller.js");
  const print = read("app/servo-program-print-integration.js");
  assert.match(defaults, /TopModul \(DTS4\)/);
  assert.match(defaults, /TopModul \(DTS3\)/);
  assert.match(controls, /canonicalMachineType/);
  assert.match(renderer, /DTS3 0–45°/);
  assert.match(renderer, /physicalToRpcTableAngle/);
  assert.match(events, /rpcToPhysicalTableAngle/);
  assert.match(transfer, /Table Angle \(DTS3 0-45\)/);
  assert.match(print, /RPC Table Scale/);
});
