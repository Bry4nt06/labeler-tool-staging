"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

function simulationFixture() {
  const renders = [];
  const state = {
    activeTab: "program",
    program: [
      { hmi: 1, plc: 0, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Generated start", autocolBoundary: "start-shape" },
      { hmi: 2, plc: 1, cmd: 7, tableAngle: 20, plateAngle: 40, action: "Generated correction" },
      { hmi: 3, plc: 2, cmd: 3, tableAngle: 40, plateAngle: 40, action: "Generated end", autocolBoundary: "end-curve" }
    ],
    simulation: {
      useCustom: false,
      source: "blank",
      turns: [],
      rows: [],
      deletedRows: [],
      lines: []
    },
    maxMoveRatio: 21,
    previewAngle: 0,
    radius: 250,
    direction: "ccw",
    encoderCountsPerRev: 4096,
    servoGearRatio: 1
  };
  const context = {
    console,
    state,
    activeMachineUsesAutocolCommands: () => true,
    norm(value) {
      const normalized = Number(value) % 360;
      return normalized < 0 ? normalized + 360 : normalized;
    },
    angleToXY() { return { x: 0, y: 0 }; },
    fmt(value) { return String(value); },
    finishAngle(value) { return value; },
    LabelerWorkspaceActionService: {
      number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      },
      call(name, ...args) {
        if (typeof context[name] === "function") return context[name](...args);
        return undefined;
      },
      execute(options = {}) {
        const result = options.mutate?.();
        renders.push(options.render || null);
        return result;
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("app/simulation-engine.js"), context, { filename: "simulation-engine.js" });
  vm.runInContext(read("app/controllers/simulation-controller.js"), context, { filename: "simulation-controller.js" });
  return { context, state, renders };
}

test("blank simulation never hydrates itself from the generated program", () => {
  const { context, state } = simulationFixture();

  assert.deepEqual(Array.from(context.simulationProgram()), []);
  assert.equal(state.simulation.source, "blank");
  assert.equal(state.simulation.useCustom, true,
    "The simulator always owns an independent editable program, including an empty one.");
  assert.equal(state.program.length, 3);
});

test("generated rows are copied only by the explicit load action", () => {
  const { context, state } = simulationFixture();

  context.LabelerSimulationController.loadGeneratedTurns();
  assert.equal(state.simulation.source, "generated-copy");
  assert.equal(state.simulation.lines.length, state.program.length);
  assert.notEqual(state.simulation.lines[0], state.program[0]);

  state.simulation.lines[0].plateAngle = 99;
  assert.equal(state.program[0].plateAngle, 0,
    "Editing the simulator copy must not mutate the generated servo program.");
});

test("deleting any simulator line is durable and Autocol grammar does not recreate it", () => {
  const { context, state } = simulationFixture();

  context.LabelerSimulationController.loadGeneratedTurns();
  context.deleteSimulationLine(0);
  assert.equal(state.simulation.lines.length, 2);
  assert.equal(state.simulation.lines.some(row => row.action === "Generated start"), false);
  assert.equal(context.simulationProgram().length, 2,
    "Reading the simulator program must not normalize deleted rows back into existence.");
});

test("top-down bottle motion comes from simulator table and plate inputs", () => {
  const { context, state } = simulationFixture();

  state.simulation = {
    useCustom: true,
    source: "manual",
    turns: [],
    rows: [],
    deletedRows: [],
    lines: [
      { cmd: 7, tableAngle: 0, plateAngle: 0, action: "Manual move" },
      { cmd: 3, tableAngle: 20, plateAngle: 40, action: "Manual rest" }
    ]
  };
  assert.equal(context.plateAngleAt(10, context.simulationProgram()), 20);

  state.activeTab = "program";
  assert.equal(context.currentProgram()[0].action, "Generated start",
    "Custom simulator rows must not replace the generated program outside the simulator.");
  state.activeTab = "simulation";
  assert.equal(context.currentProgram()[0].action, "Manual move");
});

test("clearing creates a truly blank independent program", () => {
  const { context, state } = simulationFixture();

  context.LabelerSimulationController.loadGeneratedTurns();
  context.LabelerSimulationController.clearCustomTurns();
  assert.equal(state.simulation.useCustom, true);
  assert.equal(state.simulation.source, "blank");
  assert.deepEqual(Array.from(state.simulation.lines), []);
  assert.deepEqual(Array.from(context.simulationProgram()), []);
});

test("entering the simulator starts blank once per tab opening", () => {
  const openCalls = [];
  const panels = new Map();
  const makePanel = id => {
    const classes = new Set();
    return {
      id,
      hidden: false,
      dataset: {},
      style: { removeProperty() {} },
      classList: {
        toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); },
        remove(name) { classes.delete(name); }
      },
      setAttribute() {},
      removeAttribute() {}
    };
  };
  ["specs", "buildInputs", "program", "diagnostics", "simulation"].forEach(id => panels.set(id, makePanel(id)));

  const context = {
    console,
    state: { activeTab: "program", wipeBuilderOpen: false },
    Element: class Element {},
    LabelerSimulationController: {
      openBlankWorkspace() { openCalls.push("blank"); }
    },
    saveCurrentSettings() {},
    document: {
      documentElement: { dataset: {} },
      addEventListener() {},
      getElementById(id) { return panels.get(id) || null; },
      querySelectorAll() { return []; },
      querySelector() { return null; }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(read("app/controllers/tabs-controller.js"), context, { filename: "tabs-controller.js" });

  assert.equal(context.LabelerTabsController.activate("simulation"), true);
  assert.deepEqual(openCalls, ["blank"]);
  context.LabelerTabsController.activate("simulation");
  assert.deepEqual(openCalls, ["blank"], "Clicking the already-open simulator must not erase the current draft.");
  context.LabelerTabsController.activate("program");
  context.LabelerTabsController.activate("simulation");
  assert.deepEqual(openCalls, ["blank", "blank"]);
});

const rendererSource = read("app/simulation-table-renderer.js");
assert.match(rendererSource, /simulation-add-line/,
  "A blank simulator must still render an Add Line control.");

console.log("Independent blank Servo Simulation ownership regression passed.");
