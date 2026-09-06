"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const extend = require(path.join(root, "app/troubleshooting/rpc-danfoss-guides.js"));
const library = extend(base);
const source = fs.readFileSync(path.join(root, "app/troubleshooting/rpc-danfoss-guides.js"), "utf8");
const uiSource = fs.readFileSync(path.join(root, "app/troubleshooting/rpc-danfoss-guides-ui.js"), "utf8");
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

const expectedIds = [
  "servo-terminal-code-600",
  "rpc-servomotor-replacement-guide",
  "rpc-power-monitoring-diagnostics"
];

function combinedText(entry) { return JSON.stringify(entry); }

test("v359 adds exactly the three approved RPC/Danfoss guide records without replacing existing fault methods", () => {
  assert.deepEqual([...library.rpcDanfossGuideIds], expectedIds);
  expectedIds.forEach((id) => assert.ok(library.getEntry(id), `missing ${id}`));
  assert.equal(library.getEntry("servo-power-timeout").code, "SERVOPOWER_TIMEOUT");
  assert.equal(library.getEntry("servo-feedback").code, "SERVOFEEDBACK");
  assert.equal(library.getEntry("io-box-communication").code, "IOBOXCOMM");
  assert.equal(library.entries.length, base.entries.length + 3);
  assert.equal(library.validate().ok, true, library.validate().errors.join(" | "));
});

test("Code 600 stays legacy Power-PC scoped and preserves the archived wait only as historical evidence", () => {
  const entry = library.getEntry("servo-terminal-code-600");
  const text = combinedText(entry);
  assert.equal(entry.code, "600");
  assert.match(text, /legacy Power-PC|Power-PC generation/i);
  assert.match(text, /verify.*generation|generation.*verify/i);
  assert.match(text, /about two minutes/i);
  assert.match(text, /historical procedure evidence/i);
  assert.deepEqual([...entry.related], ["servo-power-timeout", "io-box-communication", "servo-version", "servo-enumeration"]);
  assert.equal(entry.sourceRefs[0].sourceId, "danfoss-servo-bottle-plate-system");
  assert.equal(library.searchEntries("600", {}, 8)[0].id, entry.id);
});

test("servomotor replacement remains downstream qualified maintenance and does not invent mechanical specifications", () => {
  const entry = library.getEntry("rpc-servomotor-replacement-guide");
  const text = combinedText(entry);
  assert.match(text, /after fault isolation|after the fault has been isolated|Complete the applicable/i);
  assert.match(text, /qualified maintenance|qualified-maintenance/i);
  assert.match(text, /current machine-specific OEM\/site replacement procedure|current approved maintenance/i);
  assert.match(text, /connector tool/i);
  assert.match(text, /motor-ID/i);
  assert.match(text, /spacer/i);
  assert.match(text, /seal/i);
  assert.equal(entry.sourceRefs[0].sourceId, "rpc-dts5-2011");
  assert.deepEqual([...entry.related], ["servo-feedback", "servo-malfunction", "servo-power-loss", "servo-count", "servo-enumeration", "servo-version"]);
  assert.doesNotMatch(text, /\b\d+(?:\.\d+)?\s*(?:N\s*\.?m|Nm|ft\s*[- ]?lb|in\s*[- ]?lb)\b/i);
  assert.doesNotMatch(text, /connector\s+pin\s*\d+/i);
  assert.doesNotMatch(text, /firmware\s+(?:v|version)?\s*\d/i);
});

test("power monitoring is evidence-only and retains the qualified electrical / machine-specific mapping gate", () => {
  const entry = library.getEntry("rpc-power-monitoring-diagnostics");
  const text = combinedText(entry);
  assert.match(text, /300 V supply/i);
  assert.match(text, /line\/phase/i);
  assert.match(text, /CAN/i);
  assert.match(text, /current/i);
  assert.match(text, /temperature/i);
  assert.match(text, /humidity/i);
  assert.match(text, /qualified personnel|qualified electrical/i);
  assert.match(text, /No fuse-to-output\/device mapping/i);
  assert.match(text, /No machine-specific CAN parameter/i);
  assert.equal(entry.sourceRefs[0].sourceId, "rpc-dts5-2011");
  assert.deepEqual([...entry.related], ["servo-power-timeout", "servo-enable-timeout", "servo-power-loss", "io-box-communication"]);
});

test("v359 records publish no archived IP addresses or universal machine-specific settings", () => {
  const recordsText = expectedIds.map((id) => combinedText(library.getEntry(id))).join("\n");
  assert.doesNotMatch(recordsText, /\b(?:\d{1,3}\.){3}\d{1,3}\b/);
  assert.doesNotMatch(recordsText, /CAN\s*(?:ID|address|baud|rate)\s*[:=]\s*\d/i);
  assert.match(recordsText, /Do not publish or reuse archived IP addresses/i);
  assert.match(recordsText, /not.*universal|universal.*not/i);
});

test("v359 guide UI links to existing records without a self-triggering microtask observer", () => {
  assert.match(uiSource, /data-rpc-danfoss-open/);
  assert.match(uiSource, /data-rpc-danfoss-guide-ui/);
  assert.match(uiSource, /existing\?\.dataset\.rpcDanfossGuideUi === entry\.id/);
  assert.match(uiSource, /global\.setTimeout/);
  assert.doesNotMatch(uiSource, /queueMicrotask\(render\)/);
});

test("v359 records remain loaded under v363-or-later with v362/v361 imports, v360 exact-search precedence, and the v358 shell", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(page);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 363, `expected v363 or later, got v${versionMatch?.[1]}`);
  assert.match(page, /troubleshooting-bootstrap-v358-20260904/);
  const baseIndex = page.indexOf("diagnostic-library.js");
  const guideIndex = page.indexOf("rpc-danfoss-guides.js");
  const bridgeIndex = page.indexOf("topmodul-rpc-method-bridge.js");
  const webIndex = page.indexOf("apl-cart-web-handling.js");
  const servoIndex = page.indexOf("apl-cart-servo-status.js");
  const tailIndex = page.indexOf("apl-cart-tail-status.js");
  const searchPrecedenceIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  const uiIndex = page.indexOf("rpc-danfoss-guides-ui.js");
  assert.ok(baseIndex >= 0 && guideIndex > baseIndex && bridgeIndex > guideIndex);
  assert.ok(webIndex > bridgeIndex && servoIndex > webIndex && tailIndex > servoIndex && searchPrecedenceIndex > tailIndex && appIndex > searchPrecedenceIndex);
  assert.ok(uiIndex > appIndex);
  assert.match(page, /rpc-danfoss-guides-v359-20260904&shell=v358/);
  assert.match(page, /troubleshooting-search-precedence-v360(?:\.\d+)?-\d{8}&shell=v358/);
  assert.match(page, /troubleshooting-apl-cart-tail-v363-20260904&shell=v358/);
});