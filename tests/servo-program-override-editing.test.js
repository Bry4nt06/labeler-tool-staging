"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const overrideSource = fs.readFileSync(path.join(root, "app", "servo-overrides.js"), "utf8");
const controllerSource = fs.readFileSync(path.join(root, "app", "controllers", "servo-program-controller.js"), "utf8");
const eventSource = fs.readFileSync(path.join(root, "app", "controllers", "servo-program-event-controller.js"), "utf8");

const calls = [];
const executeCalls = [];
const listeners = new Map();
const programHost = {
  scrollTop: 41,
  scrollLeft: 17,
  contains(target) { return Boolean(target?.insideProgram); }
};

class FakeElement {
  constructor(field, value) {
    this.dataset = { programField: field };
    this.value = value;
    this.insideProgram = true;
    this.blurCount = 0;
  }
  closest(selector) {
    if (selector === "tr[data-program-hmi]") return { dataset: { programHmi: "1" } };
    return null;
  }
  blur() { this.blurCount += 1; }
}

const state = {
  activeMapId: "map-1",
  applicationMode: "apl",
  selectedBrand: "brand-1",
  selectedBottle: "bottle-1",
  servoOverrides: {},
  program: [{
    hmi: 1,
    plc: 0,
    cmd: 3,
    tableAngle: 100,
    plateAngle: 20,
    generatedTableAngle: 100,
    generatedPlateAngle: 20,
    tableAngleOverride: null,
    plateAngleOverride: null
  }]
};

const sandbox = {
  window: null,
  globalThis: null,
  state,
  els: { program: programHost },
  Element: FakeElement,
  console,
  scrollX: 0,
  scrollY: 225,
  pageXOffset: 0,
  pageYOffset: 225,
  scrollTo(x, y) { calls.push({ name: "scrollTo", args: [x, y] }); },
  requestAnimationFrame(callback) { callback(); },
  setTimeout(callback) { callback(); },
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  document: {
    addEventListener(type, handler, options) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, options });
    }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

sandbox.LabelerWorkspaceActionService = {
  call(name, ...args) {
    calls.push({ name, args });
    if (name === "setServoAngleOverride") return sandbox.setServoAngleOverride(...args);
    return true;
  },
  execute(options) { executeCalls.push(options); return true; },
  number(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
};

vm.createContext(sandbox);
vm.runInContext(overrideSource, sandbox, { filename: "servo-overrides.js" });
vm.runInContext(controllerSource, sandbox, { filename: "servo-program-controller.js" });
vm.runInContext(eventSource, sandbox, { filename: "servo-program-event-controller.js" });

function dispatch(type, target, extras = {}) {
  const event = {
    target,
    key: extras.key || "",
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopImmediatePropagation() { this.propagationStopped = true; }
  };
  for (const { handler } of listeners.get(type) || []) handler(event);
  return event;
}

function callsNamed(name) {
  return calls.filter((call) => call.name === name);
}

const input = new FakeElement("plateAngle", "-173.5");
let event = dispatch("input", input);
assert.strictEqual(event.propagationStopped, true, "Override typing should be owned by the Servo Program event controller.");
assert.deepStrictEqual(callsNamed("setServoAngleOverride").at(-1).args.slice(1), ["plateAngle", "-173.5"]);
assert.strictEqual(state.program[0].plateAngleOverride, -173.5, "Typing must update the live row override immediately.");
assert.strictEqual(state.program[0].plateAngle, -173.5, "Typing must update the live effective bottle angle immediately.");
assert.strictEqual(executeCalls.length, 0, "Typing must not trigger a full application render.");

input.value = "-173.0";
event = dispatch("change", input);
assert.strictEqual(event.propagationStopped, true, "Number spinner changes should remain stable and not rerender.");
assert.strictEqual(state.program[0].plateAngleOverride, -173);
assert.strictEqual(state.program[0].plateAngle, -173);
assert.strictEqual(executeCalls.length, 0);

const beforeCommitSetCount = callsNamed("setServoAngleOverride").length;
event = dispatch("focusout", input);
assert.strictEqual(event.propagationStopped, true);
assert.strictEqual(callsNamed("setServoAngleOverride").length, beforeCommitSetCount + 1);
assert.strictEqual(callsNamed("applyGeneratedServoProfile").length, 0, "Blur must not regenerate and replace all generated rows.");
for (const name of ["renderProgram", "renderValidation", "renderAnimationFrame"]) {
  assert.ok(callsNamed(name).length >= 1, `${name} should refresh after commit.`);
}
assert.strictEqual(callsNamed("renderSimulation").length, 0, "Override commit should not rebuild the Simulation workspace.");
assert.strictEqual(executeCalls.length, 0, "Override commit must not call render: all.");
assert.strictEqual(programHost.scrollTop, 41);
assert.strictEqual(programHost.scrollLeft, 17);
assert.deepStrictEqual(callsNamed("scrollTo").at(-1).args, [0, 225], "Page scroll should be restored after targeted refresh.");

const clearInput = new FakeElement("plateAngle", "");
dispatch("input", clearInput);
assert.strictEqual(state.program[0].plateAngleOverride, null, "Clearing must remove the live override immediately.");
assert.strictEqual(state.program[0].plateAngle, 20, "Clearing must restore the generated bottle angle immediately.");
dispatch("focusout", clearInput);
assert.deepStrictEqual(callsNamed("setServoAngleOverride").at(-1).args.slice(1), ["plateAngle", ""], "Blank input must remove the override rather than become zero.");
assert.strictEqual(state.program[0].plateAngleOverride, null);
assert.strictEqual(state.program[0].plateAngle, 20);
assert.strictEqual(executeCalls.length, 0);

const profileKey = "map-1|apl|brand-1|bottle-1";
assert.strictEqual(state.servoOverrides[profileKey], undefined, "Clearing the final field must remove the stored row/profile override.");

const enterInput = new FakeElement("tableAngle", "250.5");
event = dispatch("keydown", enterInput, { key: "Enter" });
assert.strictEqual(event.defaultPrevented, true);
assert.strictEqual(event.propagationStopped, true);
assert.strictEqual(enterInput.blurCount, 1, "Enter should finish the edit through blur without submitting or jumping the page.");

for (const type of ["input", "change", "focusout", "keydown"]) {
  assert.ok(listeners.has(type), `${type} listener must be installed.`);
  assert.ok((listeners.get(type) || []).every(({ options }) => options === true), `${type} must be capture-owned.`);
}

assert.ok(!controllerSource.includes("applyGeneratedServoProfile"), "Override commit must never regenerate the complete Servo Program.");
assert.ok(overrideSource.includes("row[metadata.overrideField]"), "The real override service must synchronize the live row during editing.");

console.log("Servo Program live override editing regression passed.");
