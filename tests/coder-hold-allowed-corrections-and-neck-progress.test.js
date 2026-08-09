"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const diagnosticSource = fs.readFileSync(path.join(root, "app", "topmodul-allowed-correction-diagnostics-integration.js"), "utf8");
const telemetrySource = fs.readFileSync(path.join(root, "app", "wipe-telemetry-service.js"), "utf8");
const orientationDriverSource = fs.readFileSync(path.join(root, "drivers", "profile", "map-object-orientation-driver.js"), "utf8");
const terminalPolicySource = fs.readFileSync(path.join(root, "app", "topmodul-coder-terminal-source-policy-integration.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const apl6Map = require("../config/default-programs/map-apl-6-aggregate.json");

assert.doesNotThrow(() => new vm.Script(diagnosticSource, { filename: "topmodul-allowed-correction-diagnostics-integration.js" }));
assert.doesNotThrow(() => new vm.Script(telemetrySource, { filename: "wipe-telemetry-service.js" }));
assert.doesNotThrow(() => new vm.Script(orientationDriverSource, { filename: "map-object-orientation-driver.js" }));
assert.doesNotThrow(() => new vm.Script(terminalPolicySource, { filename: "topmodul-coder-terminal-source-policy-integration.js" }));

assert.equal(apl6Map.name, "APL 6-Aggregate");
assert.equal(apl6Map.aggregateCount, 6);
assert.equal(apl6Map.stationCount, 6);
const coder = apl6Map.objects.find((item) => item.kind === "coding");
assert.ok(coder);
assert.equal(coder.start, 304);
assert.equal(coder.end, 309);

// The physical coder start is the authoritative orientation deadline.
{
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(orientationDriverSource, context);
  const window = context.LabelerMapObjectOrientationDriver.objectWindow({ item: coder, rows: [] });
  assert.equal(context.LabelerMapObjectOrientationDriver.CODER_PRE_ORIENTATION_MARGIN_DEG, 0);
  assert.equal(window.start, 304);
  assert.equal(window.physicalStart, 304);
  assert.equal(window.end, 309);
  assert.equal(window.preOrientationMarginDeg, 0);
}

// Rest-separated correction sequences remain legal; actual speed findings stay.
{
  let diagnosticMode = "mixed";
  const context = {
    console,
    state: { machineFamilyGrammar: { family: "TOPMODUL" }, programOptimization: {} },
    LabelerTopModulCorrectionChainLimit: { installed: true },
    LabelerPostWipeCoveragePolicy: { installed: true, version: 3 },
    activeMachineMap() { return { machineType: "TopModul" }; },
    LabelerProgramOptimizerDriver: {
      analyze() {
        const obsolete = {
          level: "bad",
          code: "optimizer-nonstandard-correction-chain",
          category: "structure",
          hmi: 7,
          message: "Nonstandard correction chain at HMI 7: CMD 7 → CMD 3 → CMD 7. Only standard backspin/forward-wipe pairs are accepted."
        };
        const speed = {
          level: "bad",
          code: "optimizer-speed-limit",
          category: "speed",
          hmi: 8,
          message: "HMI 8 exceeds the configured servo speed limit."
        };
        return {
          sourceRows: [],
          diagnostics: diagnosticMode === "mixed" ? [obsolete, speed] : [obsolete],
          status: "ACTION"
        };
      },
      calculateMetrics(rows, options, diagnostics) {
        return { speedFaults: diagnostics.filter((item) => item.code === "optimizer-speed-limit").length };
      }
    },
    setTimeout(callback) { callback(); },
    renderProgram() {},
    renderValidation() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(diagnosticSource, context);

  const mixed = context.LabelerProgramOptimizerDriver.analyze([], { maxMoveRatio: 21 });
  assert.equal(mixed.diagnostics.some((item) => /nonstandard correction chain/i.test(item.message)), false);
  assert.equal(mixed.diagnostics.some((item) => item.code === "optimizer-speed-limit"), true);
  assert.equal(mixed.status, "ACTION");

  diagnosticMode = "obsolete-only";
  const allowed = context.LabelerProgramOptimizerDriver.analyze([], { maxMoveRatio: 21 });
  assert.equal(allowed.diagnostics.length, 0);
  assert.equal(allowed.status, "HEALTHY");
}

// Wipe telemetry semantics are unchanged by the coder-terminal correction.
{
  const context = { console, state: { direction: "ccw" } };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(telemetrySource, context);
  const service = context.LabelerWipeTelemetryService;
  assert.equal(service.centerTackServoDirectionV2, true);
  assert.equal(service.wipeVisualSideForPlateTravel(20, "ccw"), "left");
  assert.equal(service.wipeVisualSideForPlateTravel(-20, "ccw"), "right");
  assert.equal(service.wipeVisualSideForPlateTravel(20, "cw"), "right");
  assert.equal(service.wipeVisualSideForPlateTravel(-20, "cw"), "left");
}

assert.match(terminalPolicySource, /STAGE_ORDER = 550/);
assert.match(terminalPolicySource, /preCoderMarginDeg: 0/);
assert.match(diagnosticSource, /LabelerPostWipeCoveragePolicy/);
assert.match(bootstrapSource, /topmodul-coder-terminal-source-policy-integration\.js/);
assert.doesNotMatch(bootstrapSource, /topmodul-coder-prehold-finalizer-integration\.js/);
assert.match(bootstrapSource, /coder-terminal-source-policy-v52-20260809-1940/);

console.log("Coder terminal, allowed-correction diagnostics, and wipe telemetry regression passed.");
