"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const guardSource = fs.readFileSync(path.join(root, "app/update-loop-guard-integration.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");

function browserHarness(manifest) {
  const replacements = [];
  const status = { textContent: "" };
  const button = { textContent: "Check for Updates", disabled: false };
  const storage = new Map();
  const window = {
    location: {
      href: "https://servoforge.test/index.html",
      replace(url) { replacements.push(String(url)); }
    },
    document: {
      querySelector(selector) {
        if (selector === 'meta[name="application-version"]') return { content: "0.9.10" };
        if (selector === 'meta[name="update-manifest-url"]') return { content: "./update-manifest.json" };
        if (selector === "#updateCheckStatus") return status;
        if (selector === "#checkForUpdates") return button;
        return null;
      }
    },
    SERVOFORGE_RELEASE_VERSION: "0.9.10",
    ServoForgeBootstrapBuild: "installed-build-a",
    navigator: {},
    sessionStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    async fetch() {
      return { ok: true, status: 200, async json() { return manifest.current; } };
    },
    setTimeout,
    clearTimeout
  };
  const context = vm.createContext({ window, globalThis: window, URL, console, Date, Object, Promise, Number, String, Math, JSON, setTimeout, clearTimeout });
  vm.runInContext(guardSource, context, { filename: "update-loop-guard-integration.js" });
  return { window, replacements, status, button };
}

test("same-version build drift never navigates", async () => {
  const manifest = { current: { version: "0.9.10", buildId: "manifest-build-b", releaseUrl: "./" } };
  const harness = browserHarness(manifest);
  const result = await harness.window.checkForToolUpdates();

  assert.equal(result.reason, "same-version-build-mismatch");
  assert.equal(harness.replacements.length, 0, "same-version build mismatch must not navigate");
  assert.match(harness.status.textContent, /automatic reload suppressed/i);
});

test("real version updates can navigate only once inside the circuit-breaker window", async () => {
  const manifest = { current: { version: "0.9.11", buildId: "release-build-c", releaseUrl: "./" } };
  const harness = browserHarness(manifest);

  const first = await harness.window.checkForToolUpdates();
  assert.equal(first.action, "navigate");
  assert.equal(harness.replacements.length, 1);

  const second = await harness.window.checkForToolUpdates();
  assert.equal(second.reason, "navigation-circuit-breaker");
  assert.equal(harness.replacements.length, 1, "repeated update check must not create a second navigation");
});

test("bootstrap loads the update-loop guard before runtime startup", () => {
  const guardIndex = bootstrapSource.indexOf('"app/update-loop-guard-integration.js"');
  const startupIndex = bootstrapSource.indexOf('"app/startup-runtime.js"');
  assert.ok(guardIndex >= 0, "bootstrap must load the update loop guard");
  assert.ok(startupIndex >= 0, "bootstrap must load startup runtime");
  assert.ok(guardIndex < startupIndex, "update loop guard must install before startup runtime");
});
