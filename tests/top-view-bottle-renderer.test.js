"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const bottleSource = fs.readFileSync(path.join(root, "app", "bottle-visual-renderer.js"), "utf8");
const mapSource = fs.readFileSync(path.join(root, "app", "mechanical-map-scene-renderer.js"), "utf8");
const simulationSource = fs.readFileSync(path.join(root, "app", "simulation-map-scene-renderer.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(bottleSource, { filename: "bottle-visual-renderer.js" }));
assert.doesNotThrow(() => new vm.Script(mapSource, { filename: "mechanical-map-scene-renderer.js" }));
assert.doesNotThrow(() => new vm.Script(simulationSource, { filename: "simulation-map-scene-renderer.js" }));

assert.match(bottleSource, /drawTopViewBottleStructure/);
assert.match(bottleSource, /data-bottle-view/);
assert.match(bottleSource, /data-bottle-top-view-shoulder/);
assert.match(bottleSource, /data-bottle-top-view-neck/);
assert.match(bottleSource, /topViewBottleV1:\s*true/);
assert.match(bottleSource, /neck:\s*Object\.freeze\(\{\s*center:\s*0/);
assert.match(bottleSource, /body:\s*Object\.freeze\(\{\s*center:\s*0/);
assert.match(bottleSource, /back:\s*Object\.freeze\(\{\s*center:\s*180/);

assert.match(
  mapSource,
  /drawBottleLabelIndicators\(add, bottle, head\.tableAngle\)/,
  "Mechanical Map must use the shared top-view bottle renderer."
);
assert.match(
  simulationSource,
  /drawBottleLabelIndicators\(add, bottle, head\.tableAngle\)/,
  "Servo Simulation must use the same shared top-view bottle renderer."
);
assert.match(bootstrapSource, /top-view-bottles-20260807-1054/);

const elements = [];
const group = {
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = String(value); }
};
const context = {
  window: null,
  state: { previewBottleAngle: null },
  selectedLabelApplicationState() { return { neck: true, body: true, back: true }; },
  activeAggregateDefinitions() {
    return [
      { number: 1, angle: 10 },
      { number: 3, angle: 20 },
      { number: 5, angle: 30 }
    ];
  },
  labelSectionForStation(station) { return ({ 1: "neck", 3: "body", 5: "back" })[station]; },
  norm(value) { return ((Number(value) % 360) + 360) % 360; },
  currentProgram() { return []; },
  plateAngleAt() { return 0; },
  console
};
context.window = context;
vm.createContext(context);
vm.runInContext(bottleSource, context, { filename: "bottle-visual-renderer.js" });

context.drawBottleLabelIndicators((name, attrs, parent) => {
  const element = { name, attrs, parent };
  elements.push(element);
  return element;
}, group, 40);

assert.equal(group.attributes["data-bottle-view"], "top");
assert.ok(elements.some((element) => element.attrs?.["data-bottle-top-view-shoulder"] === "true"));
assert.ok(elements.some((element) => element.attrs?.["data-bottle-top-view-neck"] === "true"));
assert.equal(elements.filter((element) => element.attrs?.["data-bottle-label-indicator"]).length, 3);

console.log("ServoForge top-view bottle rendering regression passed.");
