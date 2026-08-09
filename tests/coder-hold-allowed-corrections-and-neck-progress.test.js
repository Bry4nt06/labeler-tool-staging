"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const coderSource = fs.readFileSync(path.join(root, "app", "topmodul-coder-prehold-finalizer-integration.js"), "utf8");
const diagnosticSource = fs.readFileSync(path.join(root, "app", "topmodul-allowed-correction-diagnostics-integration.js"), "utf8");
const telemetrySource = fs.readFileSync(path.join(root, "app", "wipe-telemetry-service.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(coderSource, { filename: "topmodul-coder-prehold-finalizer-integration.js" }));
assert.doesNotThrow(() => new vm.Script(diagnosticSource, { filename: "topmodul-allowed-correction-diagnostics-integration.js" }));
assert.doesNotThrow(() => new vm.Script(telemetrySource, { filename: "wipe-telemetry-service.js" }));

{
  const context = {
    console,
    state: {
      applicationMode: "apl",
      program: [],
      motionPlan: { rows: [], termination: {} }
    },
    LabelerProfilePipelineOrchestratorInstalled: true,
    LabelerCoderWindowReferenceHandoff: { installed: true },
    LabelerTopModulCorrectionChainLimit: { installed: true },
    activeMachineMap() {
      return { machineType: "TopModul", applicationMode: "apl" };
    },
    applyGeneratedServoProfile() {
      const rows = [
        { cmd: 3, tableAngle: 290, plateAngle: 180, action: "Back Wipe Hold" },
        { cmd: 7, tableAngle: 290.5, plateAngle: 180, action: "Direct Turn for Coding", codingMotion: "direct-shortest-path", codingWindowStart: 304 },
        { cmd: 7, tableAngle: 303, plateAngle: 162.5, action: "Hold for Coding", codingHold: true, activeHold: true, codingReadyTableAngle: 303, codingWindowStart: 304, codingWindowStop: 315 },
        { cmd: 3, tableAngle: 359, plateAngle: 163.2, action: "End Curve - Rest", terminalRest: true }
      ].map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
      context.state.program = rows;
      context.state.motionPlan.rows = rows;
      return rows;
    },
    setTimeout(callback) { callback(); }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(coderSource, context);

  assert.equal(context.LabelerTopModulCoderPreholdFinalizer.lateProfilePipelineReady(), true);
  const rows = context.applyGeneratedServoProfile();
  assert.equal(rows.length, 3, "TopModul must end at the coding-ready hold, not at a 359° terminal row.");
  assert.equal(rows.at(-1).cmd, 3, "Coding-ready row must be a stopped CMD 3 hold.");
  assert.equal(rows.at(-1).tableAngle, 303, "The stop must occur before the 304° coder window begins.");
  assert.equal(rows.at(-1).plateAngle, 162.5, "The coding orientation must remain the achieved target angle.");
  assert.equal(rows.at(-1).action, "Hold for Coding");
  assert.equal(rows.at(-1).topModulPreCoderHold, true);
  assert.equal(rows.at(-1).terminalRest, true);
  assert.equal(rows.some((row) => Number(row.tableAngle) === 359), false, "TopModul must not continue a coding move to 359°.");
  assert.equal(context.state.motionPlan.termination.tableAngle, 303);
  assert.equal(context.state.motionPlan.termination.command, "Rest");
}

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
          message: "Nonstandard correction chain at HMI 7: CMD 7 → CMD 3 → CMD 7. Only standard backspin/forward-wipe pairs are accepted.",
          recommendation: "Review this sequence before use. Auto correction is intentionally disabled for nonstandard chains."
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

  assert.equal(context.LabelerTopModulAllowedCorrectionDiagnostics.lateOptimizerReady(), true);
  const mixed = context.LabelerProgramOptimizerDriver.analyze([], { maxMoveRatio: 21 });
  assert.equal(mixed.diagnostics.some((item) => /nonstandard correction chain/i.test(item.message)), false, "CMD 7 → CMD 3 → CMD 7 must not be treated as an illegal chain.");
  assert.equal(mixed.diagnostics.some((item) => item.code === "optimizer-speed-limit"), true, "Actual servo-speed faults must remain visible.");
  assert.equal(mixed.status, "ACTION");

  diagnosticMode = "obsolete-only";
  const allowed = context.LabelerProgramOptimizerDriver.analyze([], { maxMoveRatio: 21 });
  assert.equal(allowed.diagnostics.length, 0);
  assert.equal(allowed.status, "HEALTHY", "A rest-separated correction sequence inside the speed envelope is allowed.");
}

{
  const context = {
    console,
    state: { direction: "ccw" }
  };
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
  assert.equal(/usesOppositeContactSides/.test(telemetrySource), false, "Center Tack direction must not be overridden by the inside/outside hardware shortcut.");
}

assert.match(coderSource, /LabelerProfilePipelineOrchestratorInstalled/);
assert.match(coderSource, /LabelerCoderWindowReferenceHandoff/);
assert.match(diagnosticSource, /LabelerPostWipeCoveragePolicy/);
assert.match(bootstrapSource, /topmodul-coder-prehold-finalizer-integration\.js/);
assert.match(bootstrapSource, /topmodul-allowed-correction-diagnostics-integration\.js/);
assert.match(bootstrapSource, /coder-prehold-allowed-corrections-v48-20260809-1836/);

console.log("Coder hold, allowed correction diagnostics, and neck progress direction regression passed.");