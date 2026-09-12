"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzerPage = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
const importPage = fs.readFileSync(path.join(root, "app/plc-analyzer/import.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
const intakeUi = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-source-intake-ui-v15.js"), "utf8");

test("Analyzer staging page exposes v15 L5K/L5X source intake", () => {
  assert.match(analyzerPage, /PLC ANALYZER v15/i);
  assert.match(analyzerPage, /L5K \/ L5X SOURCE INTAKE/i);
  assert.match(analyzerPage, /full-project L5X/i);
  assert.match(analyzerPage, /\.l5x,\.L5X/);
  assert.match(analyzerPage, /ACD remains a binary project format/i);
  assert.match(analyzerPage, /non-RLL routine content/i);
});

test("Analyzer loads v15 adapter after v14 and before the application UI", () => {
  const afi = analyzerPage.indexOf("l5k-analyzer-afi-v14.js");
  const adapter = analyzerPage.indexOf("l5x-analyzer-adapter-v15.js");
  const app = analyzerPage.indexOf("plc-analyzer.js?v=15");
  const shim = analyzerPage.indexOf("plc-source-intake-ui-v15.js");
  assert.ok(afi >= 0 && adapter > afi && app > adapter && shim > app);
});

test("Import Assistant staging page exposes v9 L5K/L5X source intake", () => {
  assert.match(importPage, /PLC IMPORT ASSISTANT v9/i);
  assert.match(importPage, /L5K \/ L5X SOURCE INTAKE/i);
  assert.match(importPage, /\.l5k,\.L5K,\.l5x,\.L5X/);
  assert.match(importPage, /component-only L5X is not treated as a complete project/i);
  assert.match(importPage, /\.ACD[\s\S]*binary project format/i);
  assert.match(importPage, /non-RLL routine content/i);
  assert.doesNotMatch(importPage, /L5X support requires a separate parser path and is not enabled/i);
});

test("Import Assistant loads v15 adapter after analyzer dependencies and before importer modules", () => {
  const dependencies = importPage.indexOf("l5k-analyzer-dependencies-v5.js");
  const adapter = importPage.indexOf("l5x-analyzer-adapter-v15.js");
  const importer = importPage.indexOf("l5k-analyzer-import.js");
  const ui = importPage.indexOf("plc-analyzer-import-v5-1.js?v=9-l5x-20260906");
  const shim = importPage.indexOf("plc-source-intake-ui-v15.js");
  assert.ok(dependencies >= 0 && adapter > dependencies && importer > adapter && ui > importer && shim > ui);
});

test("worker uses the v15 adapter and source-dispatch entry point", () => {
  assert.match(worker, /l5x-analyzer-adapter-v15\.js\?v=15/);
  assert.match(worker, /parseControllerSource \|\| analyzer\.parseL5K/);
});

test("browser intake shim accepts L5K/L5X and blocks ACD before analysis", () => {
  assert.match(intakeUi, /\.l5k,\.L5K,\.l5x,\.L5X/);
  assert.match(intakeUi, /\.acd\$\/i/);
  assert.match(intakeUi, /ACD is a binary project file/i);
  assert.match(intakeUi, /analyze\.disabled = true/);
  assert.match(intakeUi, /l5k-analyzer-worker\.js\?v=15/);
  assert.doesNotMatch(intakeUi, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB/i);
});
