"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const driver = require(path.join(rootDir, "drivers/translation/topmodul-rpc-angle-driver.js"));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

test("DTS3 translates an internal correction turn to ELGa without changing the internal 3/7 engine", () => {
  assert.equal(driver.rpcCommandLabel({ cmd: 7 }, "TopModul (DTS3)"), "ELGa");
  assert.equal(driver.rpcCommandLabel({ cmd: 3 }, "TopModul (DTS3)"), "Rest");
  assert.equal(driver.rpcCommandLabel({ cmd: 7 }, "TopModul (DTS4)"), 7);
  assert.equal(driver.rpcCommandLabel({ cmd: 7 }, "Autocol"), 7);
  assert.equal(driver.rpcCommandLabel({ cmd: 7 }, "MultiModul"), 7);
});

test("ELGa follows the supplied DTS3 absolute-target example: 7.00/180 to 9.00/360 is a 180 degree plate move", () => {
  const row = {
    cmd: 7,
    tableAngle: 56,
    plateAngle: 180,
    tableTravel: 16,
    plateTravel: 180
  };
  const target = driver.dts3ElgaTarget(row, "TopModul (DTS3)");
  assert.equal(target.command, "ELGa");
  assert.equal(target.startTablePosition, 7);
  assert.equal(target.parameter1, 9);
  assert.equal(target.startPlateAngle, 180);
  assert.equal(target.parameter2, 360);
  assert.equal(target.parameter2Mode, "absolute");
  assert.equal(target.plateTravel, 180);
  assert.equal(driver.elgaAbsoluteTravel(180, 360), 180);
});

test("DTS3 ELGa target uses the endpoint of the internal segment, not its starting setpoint", () => {
  const target = driver.dts3ElgaTarget({
    cmd: 7,
    tableAngle: 80,
    plateAngle: -40,
    tableTravel: 20,
    plateTravel: 55
  }, "TopModul (DTS3)");
  assert.equal(target.startTablePosition, 10);
  assert.equal(target.parameter1, 12.5);
  assert.equal(target.parameter2, 15);
  assert.equal(target.plateTravel, 55);
});

test("TopModul retains the two-consecutive-correction limit used by DTS3 correction chains", () => {
  const source = read("app/topmodul-correction-chain-limit-integration.js");
  assert.match(source, /MAX_CONSECUTIVE_CORRECTIONS\s*=\s*2/);
  assert.match(source, /machine\.includes\("TOPMODUL"\)/);
});

test("Servo Program presentation and CSV export expose DTS3 ELGa while preserving other machine command labels", () => {
  const presentation = read("app/servo-command-presentation.js");
  const renderer = read("app/servo-program-table-renderer.js");
  const transfer = read("app/controllers/transfer-controller.js");
  assert.match(presentation, /ELGa/);
  assert.match(presentation, /Electronic gear, absolute/);
  assert.match(renderer, /servoCommandHeading/);
  assert.match(transfer, /DTS3 Command/);
  assert.match(transfer, /Parameter 2 \/ Absolute Plate Target/);
  assert.match(transfer, /dts3ElgaTarget/);
});
