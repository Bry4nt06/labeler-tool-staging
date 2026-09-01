"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const editorSource = read("app/controllers/simulation-editor-controller.js");
const printSource = read("app/servo-program-print-integration.js");

const editorCalls = [];
const editorState = {
  activeMapId: "map-1",
  selectedBrand: "Brand A",
  selectedBottle: "Bottle A",
  applicationMode: "apl",
  mapLibrary: [{ id: "map-1", name: "Line 1 Map" }],
  labelSpecs: [{ brand: "Brand A" }],
  bottleSpecs: [{ bottleType: "Bottle A" }],
  servoProfileLibrary: [],
  activeServoProfileId: "",
  simulation: {
    useCustom: true,
    draftName: "",
    draftDescription: "",
    lines: [{ cmd: 7, tableAngle: 10, plateAngle: 20, action: "Correction" }]
  }
};
const editorContext = {
  console,
  Date,
  Math,
  JSON,
  crypto: { randomUUID: () => "draft-test" },
  CustomEvent: class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  },
  state: editorState,
  document: { querySelector() { return null; } },
  alert() {},
  confirm() { return true; },
  dispatchEvent(event) { editorCalls.push(["event", event.type, event.detail?.profile?.id]); },
  LabelerLocalPersistenceController: { flush() { editorCalls.push(["flush"]); } },
  LabelerWorkspaceActionService: {
    number(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    call(name, ...args) {
      if (name === "activeMachineMap") return editorState.mapLibrary[0];
      if (name === "deepClone") return JSON.parse(JSON.stringify(args[0]));
      if (name === "setSimulationCommand") editorState.simulation.lines[args[0]].cmd = Number(args[1]);
      return undefined;
    },
    execute(options = {}) {
      const result = options.mutate?.();
      editorCalls.push(["execute", options.persist === true, options.render]);
      return result;
    },
    render(target) { editorCalls.push(["render", target]); }
  }
};
editorContext.window = editorContext;
editorContext.globalThis = editorContext;
vm.createContext(editorContext);
vm.runInContext(editorSource, editorContext);

const editor = editorContext.LabelerSimulationEditorController;
assert.equal(typeof editor.updateDraftMetadata, "function",
  "Simulation editor must own durable draft name and description updates.");
editor.updateDraftMetadata("name", "Night shift RPC");
editor.updateDraftMetadata("description", "Retain after leaving the panel");
assert.equal(editorState.simulation.draftName, "Night shift RPC");
assert.equal(editorState.simulation.draftDescription, "Retain after leaving the panel");

editor.updateTableAngle(0, "14.5");
editor.updatePlateAngle(0, "33");
editor.updateAction(0, "Custom correction");
assert.equal(editorState.simulation.lines[0].tableAngle, 14.5);
assert.equal(editorState.simulation.lines[0].plateAngle, 33);
assert.equal(editorState.simulation.lines[0].action, "Custom correction");
assert.ok(editorCalls.filter((entry) => entry[0] === "execute").every((entry) => entry[1] === true),
  "Every custom simulation mutation must request immediate local persistence.");

const saved = editor.saveProfile("Night shift RPC", "Retain after leaving the panel");
assert.equal(saved.id, "rpc-draft-test");
assert.equal(saved.schemaVersion, 1);
assert.equal(saved.simulation.lines[0].plateAngle, 33);
assert.ok(editorCalls.some((entry) => entry[0] === "event" && entry[1] === "servoforge:rpc-program-saved"),
  "The authoritative save path must open the optional Community upload handoff after local persistence.");

const printState = {
  activeTab: "simulation",
  activeMapId: "map-1",
  selectedBrand: "Brand A",
  selectedBottle: "Bottle A",
  applicationMode: "apl",
  headCount: 45,
  maxMoveRatio: 21,
  buildInputs: {},
  mapLibrary: [{ id: "map-1", name: "Line 1 Map", machineType: "TopModul", headCount: 45 }],
  labelSpecs: [{ brand: "Brand A", specNumber: "A-1", neckLengthMm: 10 }],
  bottleSpecs: [{ bottleType: "Bottle A", diameterTargetMm: 60 }],
  servoProfileLibrary: [{ id: "rpc-1", name: "Night shift RPC", description: "Validated draft" }],
  activeServoProfileId: "rpc-1",
  program: [
    { hmi: 1, cmd: 3, tableAngle: 0, plateAngle: 0, action: "Generated start" },
    { hmi: 2, cmd: 3, tableAngle: 20, plateAngle: 0, action: "Generated end" }
  ],
  simulation: {
    useCustom: true,
    draftName: "Night shift RPC",
    draftDescription: "Validated draft",
    lines: [
      { cmd: 7, tableAngle: 10, plateAngle: 25, action: "Custom move" },
      { cmd: 3, tableAngle: 30, plateAngle: 50, action: "Custom rest" }
    ]
  }
};
const printContext = {
  console,
  Date,
  state: printState,
  els: { activeMapName: { textContent: "Line 1 Map" } },
  document: {
    readyState: "loading",
    addEventListener() {},
    querySelector(selector) {
      if (selector === 'meta[name="application-version"]') return { content: "0.9.10" };
      return null;
    }
  },
  activeMachineMap() { return printState.mapLibrary[0]; },
  selectedLabelSpec() { return printState.labelSpecs[0]; },
  selectedBottleSpec() { return printState.bottleSpecs[0]; },
  simulationProgram() {
    return printState.simulation.lines.map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
  },
  programSegments(rows) {
    return rows.map((row, index) => {
      const next = rows[index + 1];
      const tableTravel = next ? next.tableAngle - row.tableAngle : null;
      const plateTravel = next && Number(row.cmd) === 7 ? next.plateAngle - row.plateAngle : next ? 0 : null;
      const absSpeed = tableTravel ? Math.abs(plateTravel / tableTravel) : 0;
      return { ...row, tableTravel, plateTravel, absSpeed, moveFault: false };
    });
  }
};
printContext.window = printContext;
printContext.globalThis = printContext;
vm.createContext(printContext);
vm.runInContext(printSource, printContext);

const printer = printContext.LabelerServoProgramPrint;
const simulationModel = printer.printModel();
assert.equal(simulationModel.sourceKind, "simulation");
assert.equal(simulationModel.rows[0].action, "Custom move");
assert.equal(simulationModel.profileName, "Night shift RPC");
const simulationHtml = printer.printHtml(simulationModel);
assert.match(simulationHtml, /Custom Simulation Profile/);
assert.match(simulationHtml, /Night shift RPC/);
assert.match(simulationHtml, /Custom move/);

printState.activeTab = "program";
const generatedModel = printer.printModel();
assert.equal(generatedModel.sourceKind, "program");
assert.equal(generatedModel.rows[0].action, "Generated start");
assert.match(printer.printHtml(generatedModel), /Servo Program Build Sheet/);

const bootstrap = read("app/bootstrap.js");
const serviceWorker = read("service-worker.js");
assert.doesNotMatch(bootstrap, /rpc-program-library-integration\.js/,
  "RPC profile behavior must not retain a second controller in the bootstrap path.");
assert.doesNotMatch(serviceWorker, /rpc-program-library-integration\.js/,
  "The removed duplicate controller must not remain in the offline asset list.");

console.log("Simulation draft persistence, RPC save ownership, and shared print regression passed.");
