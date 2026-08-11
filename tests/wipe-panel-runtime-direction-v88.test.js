"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "../app/wipe-telemetry-service.js"), "utf8");
const renderer = fs.readFileSync(path.resolve(__dirname, "../app/wipe-telemetry-renderer.js"), "utf8");

const functionStart = source.indexOf("function liveWipeMachineDirection()");
const functionEnd = source.indexOf("function wipeVisualApplication", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart, "liveWipeMachineDirection must exist");
const directionFunction = source.slice(functionStart, functionEnd);

const runtimeIndex = directionFunction.indexOf("state.direction");
const mapIndex = directionFunction.indexOf("activeMachineMap");
assert.ok(runtimeIndex >= 0, "wipe direction must read the synchronized runtime direction");
assert.ok(mapIndex >= 0, "active map direction should remain a fallback");
assert.ok(runtimeIndex < mapIndex, "runtime direction must take precedence over persisted map direction");
assert.match(source, /liveWipeMachineDirection\(\) === "cw" \? "ltr" : "rtl"/);
assert.match(source, /wipeVisualSideForPlateTravel\(plateTravel\)/);
assert.match(source, /runtimeDirectionParityV88: true/);
assert.match(renderer, /"Right → left"/);
assert.match(renderer, /"Left → right"/);

console.log("Wipe panel runtime direction v88 regression passed: CW=L->R, CCW=R->L using the same runtime direction as the Mechanical Map.");
