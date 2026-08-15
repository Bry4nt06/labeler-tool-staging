"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const hotfixPath = path.join(root, "app", "autocol-terminal-boundary-v120.js");
const appPath = path.join(root, "app.js");
const manifestPath = path.join(root, "update-manifest.json");
const source = fs.readFileSync(hotfixPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const build = "autocol-end-curve-v120-20260814-2319";

assert.doesNotThrow(() => new vm.Script(source, { filename: hotfixPath }));

let machineType = "Autocol";
const baseRows = [
  { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Start Rest", motionEventId: "ME-START" },
  { hmi: 2, plc: 1, cmd: 7, tableAngle: 283, plateAngle: 125, action: "Wipe Turn 2 Body - Agg 4", motionEventId: "ME-WIPE" },
  { hmi: 3, plc: 2, cmd: 3, tableAngle: 301, plateAngle: 235, action: "Wipe Hold", motionEventId: "ME-HOLD" }
];

const state = {
  applicationMode: "apl",
  program: baseRows.map((row) => ({ ...row })),
  motionPlan: {
    rows: baseRows.map((row) => ({ ...row })),
    planner: {
      steps: baseRows.map((row, index) => ({
        index,
        eventId: row.motionEventId,
        recommendedCommand: row.cmd,
        tableAngle: row.tableAngle
      })),
      events: baseRows.map((row) => ({ id: row.motionEventId, tableAngle: row.tableAngle }))
    },
    termination: { hmi: 3, tableAngle: 301, command: "Rest" }
  },
  motionTranslation: {
    machineProfile: "AUTOCOL_FUTURE",
    rows: baseRows.map((row) => ({ ...row })),
    plan: {
      steps: baseRows.map((row, index) => ({
        index,
        eventId: row.motionEventId,
        recommendedCommand: row.cmd,
        tableAngle: row.tableAngle
      })),
      events: baseRows.map((row) => ({ id: row.motionEventId, tableAngle: row.tableAngle }))
    },
    commandSummary: { 3: 2, 7: 1 }
  }
};

const context = {
  console,
  state,
  document: { querySelector() { return null; } },
  setTimeout(callback) { callback(); return 1; },
  activeMachineMap() { return { machineType, applicationMode: "apl", name: "COB BL25 L4" }; },
  applyGeneratedServoProfile() {
    state.program = baseRows.map((row) => ({ ...row }));
  },
  LabelerServoCommandDriver: {
    moveDefinition(command) { return Number(command) === 3 ? { name: "Rest" } : { name: "Correction" }; }
  },
  LabelerMachineFamilyGrammarDriver: {
    resolveFamily(options) {
      return String(options?.machineType || "").toUpperCase().includes("AUTOCOL") ? "AUTOCOL" : "TOPMODUL";
    },
    annotateCorrectionChains(rows, options) {
      return {
        family: this.resolveFamily(options),
        rule: { id: "AUTOCOL", name: "Autocol referenced correction" },
        rows: rows.map((row) => ({ ...row, machineGrammarFamily: "AUTOCOL", machineGrammarProfile: "AUTOCOL" })),
        chains: []
      };
    }
  },
  SERVOFORGE_RELEASE_VERSION: "0.9.10"
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: hotfixPath });

assert.equal(state.program.length, 4, "Autocol must gain one dedicated terminal boundary row");
assert.equal(state.program[2].tableAngle, 301, "the final physical Rest must remain at its original table angle");
assert.equal(state.program[2].plateAngle, 235, "the final physical Rest bottle angle must not be changed");
const terminal = state.program[3];
assert.equal(terminal.hmi, 4);
assert.equal(terminal.plc, 3);
assert.equal(terminal.cmd, 3);
assert.equal(terminal.tableAngle, 359);
assert.equal(terminal.plateAngle, 235, "End of curve must hold the previous bottle angle with zero bottle motion");
assert.equal(terminal.action, "End of curve");
assert.equal(terminal.terminalRest, true);
assert.equal(terminal.autocolBoundary, "end-curve");
assert.equal(terminal.autocolProfile, true);
assert.equal(terminal.motionEventId, "ME-AUTOCOL-END-CURVE");
assert.equal(state.motionPlan.planner.steps.length, 4, "planner steps must remain one-to-one with servo rows");
assert.equal(state.motionPlan.planner.events.length, 4, "planner events must include the terminal boundary");
assert.equal(state.motionTranslation.plan.steps.length, 4, "translated plan must remain one-to-one with servo rows");
assert.equal(state.motionTranslation.plan.steps[3].eventId, terminal.motionEventId);
assert.equal(state.motionTranslation.plan.steps[3].recommendedCommand, 3);
assert.equal(state.motionTranslation.plan.steps[3].tableAngle, 359);

const beforeSecondPass = JSON.stringify(state.program);
context.ServoForgeAutocolTerminalBoundaryV120.applyAutocolTerminalBoundary();
assert.equal(JSON.stringify(state.program), beforeSecondPass, "terminal repair must be idempotent");

machineType = "TopModul";
const topModulRows = baseRows.map((row) => ({ ...row }));
const unchanged = context.ServoForgeAutocolTerminalBoundaryV120.ensureAutocolEndCurve(topModulRows);
assert.equal(unchanged.length, topModulRows.length, "TopModul rows must not gain an Autocol boundary");
assert.equal(unchanged.at(-1).tableAngle, 301);

assert.ok(app.includes(`const build = "${build}"`), "app startup must carry the v120 build id");
assert.ok(app.includes("app/autocol-terminal-boundary-v120.js"), "app startup must load the v120 terminal repair");
assert.equal(manifest.buildId, build, "update manifest must advertise v120");

console.log("Autocol terminal boundary v120 regression passed.");
