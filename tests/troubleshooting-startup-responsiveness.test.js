"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const guardSource = fs.readFileSync(path.join(root, "app/troubleshooting/troubleshooting-startup-guard.js"), "utf8");
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "app/troubleshooting/troubleshooting-app.js"), "utf8");

class MockStorage {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

function executeGuard() {
  const fullSettings = JSON.stringify({
    selectedZone: "L85",
    selectedSite: "Columbus",
    selectedBrand: "Test Brand",
    selectedBottle: "Test Bottle",
    activeMapId: "map-large",
    mapLibrary: [{ id: "map-large", name: "Large saved map", machineType: "TopModul", applicationMode: "apl", payload: "x".repeat(10000) }],
    simulation: { rows: Array.from({ length: 200 }, (_, index) => ({ index, payload: "y".repeat(100) })) }
  });
  const cachedContext = JSON.stringify({
    zone: "L85",
    site: "Columbus",
    mapName: "Large saved map",
    machineType: "TopModul",
    applicationMode: "apl",
    brand: "Test Brand",
    bottle: "Test Bottle"
  });
  const localStorage = new MockStorage({
    labelerToolSettings: fullSettings,
    "servoforge-troubleshooting-context-v1": cachedContext
  });
  let fullValidationCalls = 0;
  const baseLibrary = Object.freeze({
    version: "test-library",
    entries: Object.freeze([{ id: "one" }]),
    flows: Object.freeze([]),
    sources: Object.freeze([{ id: "source" }]),
    getEntry() {},
    getFlow() {},
    getSource() {},
    searchEntries() { return []; },
    searchSources() { return []; },
    normalize(value) { return String(value || "").toLowerCase(); },
    validate() { fullValidationCalls += 1; return { ok: true, errors: [] }; }
  });
  const domListeners = new Map();
  const document = {
    readyState: "loading",
    addEventListener(type, listener) { domListeners.set(type, listener); },
    getElementById() { return null; }
  };
  const window = {
    localStorage,
    Storage: MockStorage,
    ServoForgeTroubleshootingLibrary: baseLibrary,
    Worker: function MockWorker() {},
    requestIdleCallback() {},
    setTimeout() {},
    document,
    Blob: function MockBlob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }
  };
  const context = {
    window,
    document,
    Storage: MockStorage,
    Blob: window.Blob,
    URL: window.URL,
    JSON,
    Date,
    Object,
    Array,
    Map,
    Set,
    String,
    RegExp,
    Number,
    Boolean,
    Error
  };
  vm.runInNewContext(guardSource, context, { filename: "troubleshooting-startup-guard.js" });
  return { window, localStorage, fullSettings, getFullValidationCalls: () => fullValidationCalls };
}

test("v356 startup guard prevents the troubleshooting controller from reading the full saved workspace", () => {
  const runtime = executeGuard();
  const visibleSettings = JSON.parse(runtime.localStorage.getItem("labelerToolSettings"));
  assert.equal(visibleSettings.selectedSite, "Columbus");
  assert.equal(visibleSettings.selectedZone, "L85");
  assert.equal(visibleSettings.mapLibrary.length, 1);
  assert.equal(visibleSettings.mapLibrary[0].name, "Large saved map");
  assert.equal(Object.hasOwn(visibleSettings, "simulation"), false);
  assert.equal(runtime.localStorage.values.get("labelerToolSettings"), runtime.fullSettings, "the real saved workspace must remain untouched");
});

test("v356 browser validation is a lightweight smoke check and preserves full validation for engineering use", () => {
  const runtime = executeGuard();
  const library = runtime.window.ServoForgeTroubleshootingLibrary;
  assert.equal(library.runtimeValidationMode, "startup-smoke-v356");
  assert.equal(library.validate().ok, true);
  assert.equal(runtime.getFullValidationCalls(), 0, "normal page startup must not execute the full recursive library validation");
  assert.equal(typeof library.fullValidate, "function");
  assert.equal(library.fullValidate().ok, true);
  assert.equal(runtime.getFullValidationCalls(), 1);
});

test("v356 guard remains after all v363-or-later diagnostic engines and immediately before the troubleshooting controller", () => {
  const foundationIndex = page.indexOf("apl-cart-foundation.js");
  const webIndex = page.indexOf("apl-cart-web-handling.js");
  const servoIndex = page.indexOf("apl-cart-servo-status.js");
  const tailIndex = page.indexOf("apl-cart-tail-status.js");
  const sourceBridgeIndex = page.indexOf("topmodul-live-00067-source-bridge.js");
  const searchPrecedenceIndex = page.indexOf("troubleshooting-search-precedence.js");
  const guardIndex = page.indexOf("troubleshooting-startup-guard.js");
  const controllerIndex = page.indexOf("troubleshooting-app.js");
  assert.ok(foundationIndex >= 0 && webIndex > foundationIndex && servoIndex > webIndex && tailIndex > servoIndex && sourceBridgeIndex > tailIndex);
  assert.ok(searchPrecedenceIndex > sourceBridgeIndex && guardIndex > searchPrecedenceIndex);
  assert.ok(controllerIndex > guardIndex);
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 363, `expected v363 or later, got v${versionMatch?.[1]}`);
  assert.match(page, /troubleshooting-startup-v356-20260904/);
});

test("startup guard keeps full workspace parsing off the troubleshooting controller's critical path", () => {
  assert.match(appSource, /context:\s*readServoForgeContext\(\)/);
  assert.match(guardSource, /key === SETTINGS_KEY/);
  assert.match(guardSource, /runtimeValidationMode:\s*"startup-smoke-v356"/);
  assert.match(guardSource, /new Worker\(url\)/);
  assert.match(guardSource, /JSON\.parse\(event\.data\)/);
  assert.match(guardSource, /Troubleshooting startup did not complete/);
});
