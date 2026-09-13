"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const rpcSource = fs.readFileSync(path.join(root, "drivers", "translation", "topmodul-rpc-angle-driver.js"), "utf8");
const wipeSource = fs.readFileSync(path.join(root, "app", "wipe-analysis-service.js"), "utf8");
const finishedSource = fs.readFileSync(path.join(root, "app", "apl-finished-centerline-completion-integration.js"), "utf8");

function planFor(machineType, staleMachineType = "") {
  let captured = null;
  const state = {
    machineType: staleMachineType,
    selectedMachineType: staleMachineType,
    buildInputs: {
      neckApplication: "Center",
      neckContactMm: 0,
      neckOverWipeDeg: 0,
      bodyContactMm: 0,
      bodyOverWipeDeg: 0,
      backContactMm: 0,
      backOverWipeDeg: 0
    }
  };
  const context = {
    window: null,
    globalThis: null,
    state,
    activeMachineMap: machineType === null ? () => null : () => ({ machineType }),
    selectedLabelSpec: () => ({
      applicationMode: "apl",
      neckBottomCircumferenceMm: 100,
      neckBottomCurveMm: 50,
      neckLengthMm: 50
    }),
    selectedBottleSpec: () => ({}),
    bodyCircumference: () => 200,
    normalizeLabelApplicationMode: (value) => value,
    num(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    LabelerGeometryDriver: {
      solveSection(options) {
        captured = options;
        return options;
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(rpcSource, context, { filename: "topmodul-rpc-angle-driver.js" });
  vm.runInContext(wipeSource, context, { filename: "wipe-analysis-service.js" });
  context.sectionWipePlan("neck");
  return captured;
}

assert.equal(planFor("TopModul (DTS3)").completeCenterTackInsideWipe, true);
assert.equal(planFor("TopModul (DTS4)").completeCenterTackInsideWipe, false);
assert.equal(planFor("TopModul").completeCenterTackInsideWipe, false);
assert.equal(planFor("Autocol").completeCenterTackInsideWipe, false);
assert.equal(
  planFor(null, "TopModul (DTS3)").completeCenterTackInsideWipe,
  false,
  "stale global DTS3 state must not affect a brand when no DTS3 map is active"
);

console.log("DTS3 map-only program isolation regression passed.");

function finishedPlanFor(machineType) {
  let captured = null;
  const state = {
    applicationMode: "apl",
    buildInputs: {
      neckApplication: "Center",
      neckContactMm: 0,
      neckOverWipeDeg: 0
    }
  };
  const context = {
    window: null,
    globalThis: null,
    state,
    activeMachineMap: () => ({ machineType }),
    selectedLabelSpec: () => ({
      neckBottomCircumferenceMm: 100,
      neckBottomCurveMm: 50,
      neckLengthMm: 50
    }),
    selectedBottleSpec: () => ({}),
    bodyCircumference: () => 200,
    selectedLabelApplicationState: () => ({ neck: true, body: false, back: false }),
    normalizeLabelApplicationMode: value => value,
    num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    finishAngle: (value) => Number(value),
    sectionWipePlan: () => null,
    generatedAplMapDrivenProfile: () => [],
    LabelerAplMapProfileGenerator: { generate: () => [] },
    LabelerGeometryDriver: {
      solveSection(options) {
        captured = options;
        return options;
      }
    },
    setTimeout() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(rpcSource, context, { filename: "topmodul-rpc-angle-driver.js" });
  vm.runInContext(wipeSource, context, { filename: "wipe-analysis-service.js" });
  vm.runInContext(finishedSource, context, { filename: "apl-finished-centerline-completion-integration.js" });
  context.LabelerAplFinishedCenterlineCompletion.solveAplWipe("neck");
  return captured;
}

assert.equal(finishedPlanFor("TopModul (DTS3)").completeCenterTackInsideWipe, true);
assert.equal(finishedPlanFor("TopModul (DTS4)").completeCenterTackInsideWipe, false);
