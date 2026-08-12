"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

const guidance = fs.readFileSync(path.join(root, "app/controllers/specification-sensor-guidance-controller.js"), "utf8");
const setup = fs.readFileSync(path.join(root, "app/controllers/setup-event-controller-integration.js"), "utf8");
const coldGlue = fs.readFileSync(path.join(root, "app/cold-glue-label-geometry-fallback-integration.js"), "utf8");

assert.match(guidance, /advisoryOnlyV94:\s*true/);
assert.match(guidance, /brandSelectionOwnedByBuildInputsV94:\s*true/);
assert.match(guidance, /workspaceNavigationOwnedByTabsV94:\s*true/);
assert.match(guidance, /retiredSpecNumberRequirementV94:\s*true/);
assert.doesNotMatch(guidance, /brandSelect\.value\s*=/, "Guidance must never rewrite the Brand dropdown.");
assert.doesNotMatch(guidance, /event\.target\.closest\?\.\("#brandSelect"\)/, "Guidance must not listen for Brand selection changes.");
assert.doesNotMatch(guidance, /Spec # is required\./, "Retired Spec # must not remain a required-field gate.");

assert.match(setup, /target\.id === "brandSelect"/);
assert.match(setup, /const requestedBrand = target\.value/);
assert.match(setup, /build\.selectBrand\(requestedBrand\)/);
assert.match(setup, /brandSelectionAuthorityV94:\s*true/);

const memoryStart = coldGlue.indexOf("function bindBrandMemory");
const memoryEnd = coldGlue.indexOf("function install()", memoryStart);
const memoryHandler = memoryStart >= 0 && memoryEnd > memoryStart
  ? coldGlue.slice(memoryStart, memoryEnd)
  : "";
assert.match(memoryHandler, /target\.id === "brandSelect"/);
assert.doesNotMatch(memoryHandler, /stopImmediatePropagation/);
assert.doesNotMatch(memoryHandler, /state\.selectedBrand\s*=/);

console.log("Brand selection DOM event authority v94 regression passed.");
