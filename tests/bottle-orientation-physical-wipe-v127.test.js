"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-integration.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source, { filename: "bottle-orientation-panel-integration.js" }));

function makeContext(storedDirection) {
  const styleNodes = new Map();
  const context = {
    console,
    state: {
      direction: storedDirection,
      zeroAngle: 0,
      previewAngle: 0,
      program: [],
      buildInputs: {}
    },
    document: {
      getElementById(id) {
        if (id === "mapDirection") return { value: storedDirection };
        return styleNodes.get(id) || null;
      },
      createElement(tag) {
        return { tagName: String(tag || "").toUpperCase(), id: "", textContent: "" };
      },
      head: {
        appendChild(node) {
          if (node?.id) styleNodes.set(node.id, node);
          return node;
        }
      },
      querySelector() { return null; }
    },
    activeMachineMap() { return { machineSettings: { direction: storedDirection }, objects: [], stationSections: {} }; },
    LabelerCoderOrientationDriver: {
      physicalDirection(stored) { return stored === "cw" ? "ccw" : "cw"; }
    },
    ServoForgePhysicalWipeDirectionV125: {
      physicalMachineDirection() { return storedDirection === "cw" ? "ccw" : "cw"; }
    },
    LabelerWipeTelemetryService: {},
    requestAnimationFrame() { return 1; },
    cancelAnimationFrame() {},
    performance: { now() { return 0; } }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "bottle-orientation-panel-integration.js" });
  return context;
}

// Map Builder keeps legacy storage tokens: stored ccw = physical CW.
const physicalCw = makeContext("ccw").LabelerBottleOrientationPanel;
assert.equal(physicalCw.physicalMachineDirection(), "cw");
assert.equal(
  physicalCw.topViewWipeDirection(),
  "rtl",
  "Physical CW must wipe the bottle-local circular label arc from high angle toward low angle."
);

// stored cw = physical CCW.
const physicalCcw = makeContext("cw").LabelerBottleOrientationPanel;
assert.equal(physicalCcw.physicalMachineDirection(), "ccw");
assert.equal(
  physicalCcw.topViewWipeDirection(),
  "ltr",
  "Physical CCW must mirror physical CW in the Bottle Orientation top view."
);

// Bottle Orientation must override stale linear/legacy direction metadata on every render.
assert.match(source, /coverage\.direction\s*=\s*topViewWipeDirection\(\)/);
assert.match(source, /coverage\?\.direction\s*\|\|\s*topViewWipeDirection\(\)/);

// Keep the actual servo-coordinate bottle transform unchanged.
assert.match(source, /function machineVisualAngle\(angleDeg\)[\s\S]*?direction[^\n]*===\s*"cw"\s*\?\s*-angle\s*:\s*angle/);
assert.match(source, /headOneWorldVisualAngle\(tableAngle, plateAngle\)[\s\S]*?tableFrameVisualAngle\(tableAngle\)\s*\+\s*machineVisualAngle\(plateAngle\)/);
assert.match(source, /physicalMachineDirectionWipeV127:\s*true/);
assert.match(source, /topViewAngularWipeParityV127:\s*true/);

console.log("Bottle Orientation physical machine-direction wipe v127 regression passed.");
