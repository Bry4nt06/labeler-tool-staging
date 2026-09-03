"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serviceWorker = fs.readFileSync(path.join(__dirname, "..", "service-worker.js"), "utf8");

test("troubleshooting page and runtime are part of the offline application shell", () => {
  for (const asset of [
    "./troubleshooting.html",
    "./troubleshooting.css",
    "./app/troubleshooting/diagnostic-library.js",
    "./app/troubleshooting/troubleshooting-app.js"
  ]) {
    assert.match(serviceWorker, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("navigation responses are cached by their own URL instead of overwriting index.html", () => {
  assert.match(serviceWorker, /cacheResponse\(url\.href, response\)/);
  assert.doesNotMatch(serviceWorker, /event\.request\.mode\s*===\s*["']navigate["']\s*\?\s*APP_SHELL_URL/);
});

test("offline navigation still falls back to the main shell when no page-specific cache exists", () => {
  assert.match(serviceWorker, /cache\.match\(normalizedRequest\(APP_SHELL_URL\)/);
});
