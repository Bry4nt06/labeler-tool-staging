"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const diagnosticsSource = read("app", "validation-diagnostics-integration.js");
const manifestSource = read("app", "simulation-collapsible-integration.js");

assert.doesNotThrow(
  () => new vm.Script(diagnosticsSource, { filename: "validation-diagnostics-integration.js" }),
  "Validation diagnostics integration must parse."
);
assert.doesNotThrow(
  () => new vm.Script(manifestSource, { filename: "simulation-collapsible-integration.js" }),
  "Feature manifest must parse."
);

[
  "grid-template-columns: repeat(2, minmax(0, 1fr))",
  "grid-column: 1 / -1",
  "width: 100%",
  "max-width: 100%",
  "min-width: 0",
  "overflow: hidden",
  "white-space: normal",
  "overflow-wrap: anywhere",
  "word-break: break-word",
  "@media (max-width: 430px)"
].forEach((token) => {
  assert.ok(diagnosticsSource.includes(token), `Missing fitted Validation summary rule: ${token}`);
});

assert.ok(
  diagnosticsSource.includes('<span>${result.summary.bad} faults</span>')
    && diagnosticsSource.includes('<span>${result.summary.warn} warnings</span>')
    && diagnosticsSource.includes('<span>${result.summary.ok} checks</span>')
    && diagnosticsSource.includes('<span>${result.duplicateCount} duplicates removed</span>'),
  "All four Validation metrics must remain visible."
);

assert.ok(
  !diagnosticsSource.includes("grid-template-columns:minmax(120px,1fr) repeat(4,minmax(48px,auto))"),
  "The previous width-expanding five-column layout must remain removed."
);
assert.ok(
  !diagnosticsSource.includes("white-space:nowrap"),
  "Validation metric chips must be allowed to wrap."
);
assert.ok(
  manifestSource.includes("app/validation-diagnostics-integration.js?v=0.9.8-validation-summary-fit-v2"),
  "The fitted Validation summary must use a refreshed feature-module URL."
);

console.log("Fitted Validation diagnostics summary regression passed.");
