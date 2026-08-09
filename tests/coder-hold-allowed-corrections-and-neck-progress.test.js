"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const coderSource = fs.readFileSync(path.join(root, "app", "topmodul-coder-prehold-finalizer-integration.js"), "utf8");
const diagnosticSource = fs.readFileSync(path.join(root, "app", "topmodul-allowed-correction-diagnostics-integration.js"), "utf8");
const telemetrySource = fs.readFileSync(path.join(root, "app", "wipe-telemetry-service.js"), "utf8");
const orientationDriverSource = fs.readFileSync(path.join(root, "drivers", "profile", "map-object-orientation-driver.js"), "utf8");
const coderHandoffDriverSource = fs.readFileSync(path.join(root, "drivers", "profile", "coder-handoff-driver.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const apl6Map = require("../config/default-programs/map-apl-6-aggregate.json");

assert.doesNotThrow(() => new vm.Script(coderSource, { filename: "topmodul-coder-prehold-finalizer-integration.js" }));
assert.doesNotThrow(() => new vm.Script(diagnosticSource, { filename: "topmodul-allowed-correction-diagnostics-integration.js" }));
assert.doesNotThrow(() => new vm.Script(telemetrySource, { filename: "wipe-telemetry-service.js" }));
assert.doesNotThrow(() => new vm.Script(orientationDriverSource, { filename: "map-object-orientation-driver.js" }));
assert.doesNotThrow(() => new vm.Script(coderHandoffDriverSource, { filename: "coder-handoff-driver.js" }));

assert.equal(apl6Map.name, "APL 6-Aggregate");
assert.equal(apl6Map.aggregateCount, 6, "The default APL map has six aggregates, not eight.");
assert.equal(apl6Map.stationCount, 6);

{
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(orientationDriverSource, context);
  vm.runInContext(coderHandoffDriverSource, context);

  const coding = apl6Map.objects.find((item) => item.kind === "coding");
  assert.equal(coding.start, 304);
  const window = context.LabelerMapObjectOrientationDriver.objectWindow({ item: coding, rows: [] });
  assert.equal(window.physicalStart, 304, "The physical coder remains at 304°.");
  assert.equal(window.start, 299, "The coding orientation-ready point must be 5° before the physical coder.");
  assert.equal(window.end, 309);
  assert.equal(window.preOrientationMarginDeg, 5);

  const feasible = context.LabelerCoderHandoffDriver.timing({
    holdTable: 290,
    window,
    rotation: 120,
    maxRatio: 21
  });
  assert.equal(feasible.withinWindow, true);
  assert.equal(feasible.readyDeadline, 299);
  assert.equal(feasible.readyTable, 299, "A feasible coding turn must land exactly on the 299° pre-coder line.");

  const tooLate = context.LabelerCoderHandoffDriver.timing({
    holdTable: 290,
    window,
    rotation: 200,
    maxRatio: 21
  });
  assert.equal(tooLate.withinWindow, false, "A turn that cannot finish by 299° must fail capacity instead of continuing through the coder.");
  assert.ok(tooLate.readyTable > 299);
}

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
      return {
        machineType: "TopModul",
        applicationMode: "apl",
        objects: [
          { id: "apl-coding-default", kind: "coding", start: 304, end: 309, orientBottle: true }
        ]
      };
    },
    applyGeneratedServoProfile() {
      const rows = [
        { cmd: 3, tableAngle: 290, plateAngle: 180, action: "Back Wipe Hold" },
        { cmd: 7, tableAngle: 290.5, plateAngle: 180, action: "Orient Back Code Box for Coding", codingMotion: true, codingObjectId: "apl-coding-default", codingWindowStart: 299 },
        { cmd: 3, tableAngle: 299, plateAngle: 162.5, action: "Hold Back Code Box Through Coding", codingHold: true, activeHold: true, codingObjectId: "apl-coding-default", codingReadyTableAngle: 299, codingWindowStart: 299, codingWindowStop: 309 },
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
  assert.equal(context.LabelerTopModulCoderPreholdFinalizer.PRE_CODER_MARGIN_DEG, 5);
  const rows = context.applyGeneratedServoProfile();
  assert.equal(rows.length, 3, "TopModul must end at the pre-coder hold, not at a 359° terminal row.");
  assert.equal(rows.at(-1).cmd, 3, "Coding-ready row must be a stopped CMD 3 hold.");
  assert.equal(rows.at(-1).tableAngle, 299, "The coding orientation must be completed exactly 5° before the physical 304° coder begins.");
  assert.equal(rows.at(-1).plateAngle, 162.5, "The coding orientation must remain the achieved target angle.");
  assert.equal(rows.at(-1).action, "Hold for Coding");
  assert.equal(rows.at(-1).topModulPreCoderHold, true);
  assert.equal(rows.at(-1).terminalRest, true);
  assert.equal(rows.at(-1).preCoderMarginDeg, 5);
  assert.equal(rows.at(-1).coderStartTableAngle, 304);
  assert.equal(rows.at(-1).physicalCodingWindowStart, 304);
  assert.equal(rows.some((row) => Number(row.tableAngle) > 299), false, "No servo-program row may continue beyond the five-degree pre-coder completion point.");
  assert.equal(rows.some((row) => Number(row.tableAngle) === 359), false, "TopModul must not continue a coding move to 359°.");
  assert.equal(context.state.motionPlan.termination.tableAngle, 299);
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
assert.match(coderSource, /PRE_CODER_MARGIN_DEG = 5/);
assert.match(orientationDriverSource, /CODER_PRE_ORIENTATION_MARGIN_DEG = 5/);
assert.match(diagnosticSource, /LabelerPostWipeCoveragePolicy/);
assert.match(bootstrapSource, /topmodul-coder-prehold-finalizer-integration\.js/);
assert.match(bootstrapSource, /topmodul-allowed-correction-diagnostics-integration\.js/);
assert.match(bootstrapSource, /coder-physical-five-degree-lead-v50-20260809-1905/);

console.log("APL 6-Aggregate coder five-degree physical lead, allowed correction diagnostics, and neck progress regression passed.");