"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function position(source, fragment) {
  const index = source.indexOf(fragment);
  assert.notEqual(index, -1, `Expected ${fragment} in source`);
  return index;
}

test("v4.1 compare page loads legacy parser before compare UI fallback can execute", () => {
  const page = read("app/plc-analyzer/compare.html");
  const core = position(page, './l5k-analyzer-core.js?v=1');
  const legacy = position(page, './l5k-analyzer-legacy-v4.js?v=4.1');
  const compare = position(page, './l5k-analyzer-compare.js?v=2');
  const ui = position(page, './plc-analyzer-compare.js?v=4.1');
  assert.ok(core < legacy && legacy < compare && compare < ui);
  assert.match(page, /COMPARE v4\.1 — LEGACY L5K SUPPORT/i);
});

test("v4.1 import page loads legacy parser before import assistant fallback can execute", () => {
  const page = read("app/plc-analyzer/import.html");
  const core = position(page, './l5k-analyzer-core.js?v=1');
  const legacy = position(page, './l5k-analyzer-legacy-v4.js?v=4.1');
  const importer = position(page, './l5k-analyzer-import.js?v=3');
  const ui = position(page, './plc-analyzer-import.js?v=4.1');
  assert.ok(core < legacy && legacy < importer && importer < ui);
  assert.match(page, /IMPORT ASSISTANT v4\.1 — LEGACY L5K SUPPORT/i);
});

test("v4.1 worker implementations load the legacy adapter", () => {
  const singleWorker = read("app/plc-analyzer/l5k-analyzer-worker.js");
  const compareWorker = read("app/plc-analyzer/l5k-analyzer-compare-worker.js");
  assert.match(singleWorker, /l5k-analyzer-legacy-v4\.js\?v=4/);
  assert.match(compareWorker, /l5k-analyzer-legacy-v4\.js\?v=4/);
});
