"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "drivers/mechanical/cold-glue-motion-driver.js"), "utf8");

const context = { console, window: null };
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "cold-glue-motion-driver.js" });

const driver = context.LabelerColdGlueMotionDriver;
const labelDeg = 86.75;
const overWipeDeg = 10;

const plan = driver.createPlan({
  labelDeg,
  overWipeDeg,
  maxRatio: 24,
  safetyFactor: 0.9,
  mapDirection: "ccw",
  brushes: [
    { id: "back-outside", kind: "brush", side: "outer", start: 253, end: 263 },
    { id: "back-inside", kind: "brush", side: "inner", start: 275, end: 286 }
  ]
});

const first = plan.channelMoves.find((move) => move.centerTackStage === "center-to-first-edge");
const second = plan.channelMoves.find((move) => move.centerTackStage === "edge-to-opposite-edge-protected");

assert.ok(first, "upstream Back-label brush must create the first center-out wipe");
assert.ok(second, "later Back-label brush must create the remaining center-out wipe");

const expectedPerSide = labelDeg / 2 + overWipeDeg;
assert.equal(first.rotation, expectedPerSide);
assert.equal(second.rotation, expectedPerSide,
  "the later brush must wipe only the remaining half instead of rotating a second full label length");
assert.equal(plan.totalRotation, expectedPerSide * 2);

console.log("Cold Glue remaining-label coverage regression passed.");
