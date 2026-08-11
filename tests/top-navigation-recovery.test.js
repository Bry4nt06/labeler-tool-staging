"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "controllers", "tabs-controller.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /navigationCaptureV2:\s*true/);
assert.match(source, /#wipeDownBuilderButton/);
assert.match(source, /\.tabs \.tab\[data-tab\]/);
assert.match(source, /stopImmediatePropagation/);
assert.match(bootstrap, /top-navigation-recovery-v66-20260811-1105/);
assert.match(index, /app\/bootstrap\.js\?v=0\.9\.10-top-navigation-recovery-v66-20260811-1105/);
assert.match(index, /app\/update-manager\.js\?v=0\.9\.10-top-navigation-recovery-v66-20260811-1105/);
assert.match(index, /app\.js\?v=0\.9\.10-top-navigation-recovery-v66-20260811-1105/);
assert.match(serviceWorker, /servoforge-labeler-staging-v0\.9\.10-top-navigation-recovery-v66/);
assert.doesNotMatch(index, /app\/bootstrap\.js\?v=0\.9\.10-spender-v35/);
assert.doesNotMatch(serviceWorker, /coder-window-wipe-hold-v22/);

class FakeElement {
  constructor(id = "", tabName = "") {
    this.id = id;
    this.dataset = tabName ? { tab: tabName } : {};
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name)
    };
  }

  closest(selector) {
    if (selector === "#wipeDownBuilderButton" && this.id === "wipeDownBuilderButton") return this;
    if (selector === "#closeApplicationSetup" && this.id === "closeApplicationSetup") return this;
    if (selector === "#applyApplicationSetup" && this.id === "applyApplicationSetup") return this;
    if (selector === ".tabs .tab[data-tab]" && this.dataset.tab) return this;
    return null;
  }
}

const specsTab = new FakeElement("specsTab", "specs");
const buildTab = new FakeElement("buildTab", "buildInputs");
const programTab = new FakeElement("programTab", "program");
const specsPanel = new FakeElement("specs");
const buildPanel = new FakeElement("buildInputs");
const programPanel = new FakeElement("program");
const builderButton = new FakeElement("wipeDownBuilderButton");
const builderDrawer = { hidden: true };
const rightRail = new FakeElement("mapRightRail");
const listeners = new Map();
const state = { activeTab: "specs", wipeBuilderOpen: false };

specsTab.classList.add("active");
specsPanel.classList.add("active");

const tabButtons = [specsTab, buildTab, programTab];
const panels = [specsPanel, buildPanel, programPanel];
const selectorMap = new Map([
  ["#wipeDownBuilderButton", builderButton],
  ["#applicationSetupDialog", builderDrawer],
  ["#mapRightRail", rightRail],
  ["#specs", specsPanel],
  ["#buildInputs", buildPanel],
  ["#program", programPanel],
  ['.tabs .tab[data-tab="specs"]', specsTab],
  ['.tabs .tab[data-tab="buildInputs"]', buildTab],
  ['.tabs .tab[data-tab="program"]', programTab]
]);

const document = {
  documentElement: { dataset: {} },
  querySelector(selector) { return selectorMap.get(selector) || null; },
  querySelectorAll(selector) {
    if (selector === ".tabs .tab[data-tab]") return tabButtons;
    if (selector === ".table-wrap") return panels;
    return [];
  },
  addEventListener(type, handler, options) {
    listeners.set(type, { handler, options });
  }
};

let saveCount = 0;
let renderCount = 0;
const actions = {
  execute(options = {}) {
    const result = options.mutate?.();
    if (options.persist) saveCount += 1;
    if (options.render) renderCount += 1;
    return result;
  }
};

const sandbox = {
  window: null,
  globalThis: null,
  document,
  Element: FakeElement,
  state,
  LabelerWorkspaceActionService: actions,
  LabelerMapController: {
    setBuilderOpen(open) {
      state.wipeBuilderOpen = Boolean(open);
      builderDrawer.hidden = !state.wipeBuilderOpen;
    },
    applyBuilder() { state.wipeBuilderOpen = false; builderDrawer.hidden = true; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "tabs-controller.js" });

assert.equal(sandbox.LabelerTabsController.navigationCaptureV2, true);
assert.equal(listeners.get("click")?.options, true, "Navigation recovery must bind in capture phase before the delegated fallback.");

function click(target) {
  const event = {
    target,
    defaultPrevented: false,
    stopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  listeners.get("click").handler(event);
  return event;
}

let event = click(buildTab);
assert.equal(event.defaultPrevented, true);
assert.equal(event.stopped, true);
assert.equal(state.activeTab, "buildInputs");
assert.equal(buildTab.classes.has("active"), true);
assert.equal(buildPanel.classes.has("active"), true);
assert.equal(specsPanel.classes.has("active"), false);

click(builderButton);
assert.equal(state.wipeBuilderOpen, true);
assert.equal(builderDrawer.hidden, false);
assert.equal(builderButton.classes.has("active"), true);
assert.equal(buildTab.classes.has("active"), false);

click(programTab);
assert.equal(state.wipeBuilderOpen, false, "Selecting a workspace page must close Map Builder first.");
assert.equal(state.activeTab, "program");
assert.equal(programPanel.classes.has("active"), true);
assert.ok(saveCount >= 2);
assert.ok(renderCount >= 2);

console.log("Top navigation recovery and cache coherence regression passed.");
