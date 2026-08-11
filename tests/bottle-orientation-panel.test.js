"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.match(source, /Bottle Orientation &amp; Wipe Visual/);
assert.match(source, /Station 1 live geometry/);
assert.match(source, /programForSource\(source\)/);
assert.match(source, /source === "simulation"/);
assert.match(source, /return generatedProgram\(\)/);
assert.match(source, /service\.contactedLabelCoverage/);
assert.match(source, /wipeVisualApplication/);
assert.match(source, /selectedLabelSpec/);
assert.match(source, /selectedBottleSpec/);
assert.match(source, /bodyCircumference/);
assert.match(source, /degFromMm/);
assert.match(source, /wipeSpanDeg, 5/);
assert.match(source, /\[0,90,180,270\]/);
assert.match(source, /TOP VIEW/);
assert.match(source, /SIDE VIEW/);
assert.match(source, /Play Station 1/);
assert.match(source, /data-orientation-scrubber/);
assert.match(source, /wrapRenderer\("renderProgram", "program"\)/);
assert.match(source, /wrapRenderer\("renderSimulation", "simulation"\)/);
assert.match(source, /programAccessibleWithoutSimulationV72/);
assert.match(source, /geometryDrivenLabelScaleV72/);
assert.match(source, /wipeTelemetryDrivenV72/);
assert.match(bootstrap, /app\/bottle-orientation-panel-integration\.js/);
assert.match(serviceWorker, /app\/bottle-orientation-panel-integration\.js/);

console.log("Bottle orientation panel v72 regression passed.");
