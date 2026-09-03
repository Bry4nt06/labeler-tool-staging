"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = require("../app/troubleshooting/diagnostic-library.js");
const extendTopModul = require("../app/troubleshooting/topmodul-live-diagnostics.js");

const library = extendTopModul(base);

test("TopModul live extension validates without changing the 36-file archive baseline", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join("\n"));
  assert.equal(base.sources.length, 36);
  assert.equal(library.sources.length, 37);
  assert.equal(library.getSource("field-topmodul-00067-20260903")?.kind, "Field observation");
});

test("exact TopModul HMI code 00067 opens the field diagnostic first", () => {
  const results = library.searchEntries("00067", { machineType: "TopModul" });
  assert.equal(results[0]?.id, "topmodul-00067-labeler-encoder-feedback");
  assert.ok(results[0].searchScore >= 250);
});

test("full PanelView fault text resolves to the TopModul encoder case", () => {
  const results = library.searchEntries("LABELER ENCODER FEEDBACK FAULT", { machineType: "TopModul" });
  assert.equal(results[0]?.id, "topmodul-00067-labeler-encoder-feedback");
});

test("TopModul machine context promotes the live 00067 guided path", () => {
  const flows = library.recommendFlows({ machineType: "TopModul", applicationMode: "apl" });
  assert.equal(flows[0]?.id, "topmodul-00067-encoder-flow");
  assert.ok(flows.some((flow) => flow.id === "apl-main-contactor-flow"));
});

test("live path separates no-motion, frozen feedback, and intermittent feedback", () => {
  const flow = library.getFlow("topmodul-00067-encoder-flow");
  assert.ok(flow);
  const resultIds = new Set();
  for (const node of Object.values(flow.nodes)) {
    for (const choice of node.choices) if (choice.result) resultIds.add(choice.result);
  }
  assert.ok(resultIds.has("topmodul-00067-secondary-no-motion"));
  assert.ok(resultIds.has("topmodul-00067-no-feedback-while-moving"));
  assert.ok(resultIds.has("topmodul-00067-intermittent-feedback"));
});

test("00067 guidance preserves safety boundaries and does not pretend Autocol drawing 747-993 is TopModul-specific", () => {
  const entry = library.getEntry("topmodul-00067-labeler-encoder-feedback");
  assert.ok(entry.safety.some((item) => /lockout\/tagout/i.test(item)));
  assert.ok(entry.actions.some((item) => /Do not bypass/i.test(item)));
  assert.ok(entry.checks.some((item) => /L5K\/L5X|rung\/tag/i.test(item)));
  assert.equal(entry.sourceRefs.some((ref) => ref.sourceId === "electrical-schematic-747-993"), false);
});

test("existing troubleshooting remains available through the extension", () => {
  assert.equal(library.searchEntries("SERVOCOUNT")[0]?.id, "servo-count");
  assert.ok(library.getEntry("apl-main-contactor"));
  assert.ok(library.getFlow("autocol-orientation-flow"));
});

test("troubleshooting page loads the TopModul extension after the base library and before the browser controller", () => {
  const html = fs.readFileSync(path.join(__dirname, "../app/troubleshooting/index.html"), "utf8");
  const baseIndex = html.indexOf("./diagnostic-library.js");
  const liveIndex = html.indexOf("./topmodul-live-diagnostics.js");
  const dataIndex = html.indexOf("./topmodul-plc-fault-data.js");
  const catalogIndex = html.indexOf("./topmodul-plc-fault-catalog.js");
  const appIndex = html.indexOf("./troubleshooting-app.js");
  assert.ok(baseIndex >= 0 && liveIndex > baseIndex && dataIndex > liveIndex && catalogIndex > dataIndex && appIndex > catalogIndex);
  assert.match(html, /00067/);
});
