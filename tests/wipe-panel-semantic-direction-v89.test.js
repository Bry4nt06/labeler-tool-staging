"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../app/wipe-telemetry-service.js"), "utf8");
const loader = fs.readFileSync(path.resolve(__dirname, "../app/simulation-collapsible-integration.js"), "utf8");

// Map Builder persists legacy direction tokens: stored ccw = physical Clockwise,
// stored cw = physical Counter-clockwise. The wipe panel must present physical
// direction semantics rather than the legacy storage token.
let selectedDirection = "ccw";
const sandbox = {
  console,
  document: { getElementById(id) { return id === "mapDirection" ? { value: selectedDirection } : null; } },
  state: { direction: "ccw", buildInputs: { neckApplication: "Center Tack", neckContactMm: 10, bodyContactMm: 10, backContactMm: 0 } },
  activeMachineMap() { return { machineSettings: { direction: "ccw" } }; },
  num(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const service = sandbox.LabelerWipeTelemetryService;

assert.equal(service.liveWipeMachineDirection(), "cw");
assert.equal(service.wipeVisualApplication("body", 100).direction, "ltr");

selectedDirection = "cw";
sandbox.state.direction = "cw";
assert.equal(service.liveWipeMachineDirection(), "ccw");
assert.equal(service.wipeVisualApplication("body", 100).direction, "rtl");

assert.match(loader, /wipe-telemetry-service\.js\?v=0\.9\.10-wipe-direction-v90/);
assert.match(loader, /wipe-telemetry-renderer\.js\?v=0\.9\.10-wipe-direction-v90/);
console.log("Wipe panel semantic direction v89 regression passed: physical CW=L->R, physical CCW=R->L.");
