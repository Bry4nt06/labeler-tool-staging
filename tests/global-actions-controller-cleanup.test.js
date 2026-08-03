"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const panelPath = path.join(root, "app", "controllers", "workspace-panel-controller.js");
const globalActionsPath = path.join(root, "app", "global-actions.js");
const setupStatePath = path.join(root, "app", "controllers", "setup-state-controller.js");
const startupPath = path.join(root, "app", "startup-runtime.js");
const bootstrapPath = path.join(root, "app", "bootstrap.js");

const panelSource = fs.readFileSync(panelPath, "utf8");
const globalActionsSource = fs.readFileSync(globalActionsPath, "utf8");
const setupStateSource = fs.readFileSync(setupStatePath, "utf8");
const startupSource = fs.readFileSync(startupPath, "utf8");
const bootstrapSource = fs.readFileSync(bootstrapPath, "utf8");

class FakeElement {}
const listeners = [];
const aria = {};
let renderCount = 0;
const panel = { hidden: false };
const showButton = {
  setAttribute(name, value) { aria[name] = value; }
};
const els = {
  wipeDownDataPanel: panel,
  showWipeDownData: showButton
};
const document = {
  addEventListener(type, handler, options) { listeners.push({ type, handler, options }); }
};
const sandbox = {
  window: null,
  globalThis: null,
  document,
  Element: FakeElement,
  els,
  renderWipeDownData() { renderCount += 1; },
  console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

assert.doesNotThrow(() => vm.runInContext(panelSource, sandbox, { filename: panelPath }));
assert.strictEqual(sandbox.LabelerWorkspacePanelController.installed, true);

sandbox.LabelerWorkspacePanelController.initialize();
assert.strictEqual(panel.hidden, true);
assert.strictEqual(aria["aria-expanded"], "false");

sandbox.LabelerWorkspacePanelController.setWipeTelemetryOpen(true);
assert.strictEqual(panel.hidden, false);
assert.strictEqual(aria["aria-expanded"], "true");
assert.strictEqual(renderCount, 1);

sandbox.LabelerWorkspacePanelController.setWipeTelemetryOpen(false);
assert.strictEqual(panel.hidden, true);
assert.ok(listeners.some((entry) => entry.type === "click" && entry.options === true));

assert.ok(!globalActionsSource.includes("addEventListener"), "global-actions.js must not register browser listeners.");
assert.ok(!globalActionsSource.includes("state."), "global-actions.js must not mutate application state.");
assert.ok(globalActionsSource.includes("compatibilityOnly: true"));
assert.ok(setupStateSource.includes("bindZoneSiteDeveloperMenu"));
assert.ok(setupStateSource.includes("toggleAggregateSpacing"));
assert.ok(startupSource.includes("LabelerWorkspacePanelController.initialize()"));
assert.ok(!startupSource.includes("bindGlobalActions();"));

const panelIndex = bootstrapSource.indexOf("app/controllers/workspace-panel-controller.js");
const eventIndex = bootstrapSource.indexOf("app/controllers/setup-event-controller-integration.js");
const startupIndex = bootstrapSource.indexOf("app/startup-runtime.js");
assert.ok(panelIndex >= 0 && panelIndex < eventIndex, "Workspace panel controller must load before the delegated event boundary.");
assert.ok(eventIndex < startupIndex, "Delegated events must load before startup.");

console.log("Global action controller cleanup regression passed.");
