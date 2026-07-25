"use strict";

const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync("app.js", "utf8");
const context = {
  state: { direction: "cw", zeroAngle: 0 },
  norm(angle) {
    const value = angle % 360;
    return value < 0 ? value + 360 : value;
  },
  initializeLabelerApp() {}
};
vm.createContext(context);
vm.runInContext(source, context);

function near(actual, expected, tolerance = 0.0001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not near ${expected}`);
}

let point = context.angleToXY(0, 100);
near(point.x, 0);
near(point.y, -100);
point = context.angleToXY(90, 100);
near(point.x, 100);
near(point.y, 0);
point = context.angleToXY(180, 100);
near(point.x, 0);
near(point.y, 100);
point = context.angleToXY(270, 100);
near(point.x, -100);
near(point.y, 0);

context.state.direction = "ccw";
point = context.angleToXY(90, 100);
near(point.x, -100);
near(point.y, 0);

assert.equal(context.angleToSvgRotation(0), 270);
assert.equal(context.angleToSvgRotation(90), 180);

console.log("mechanical coordinate system test passed");
