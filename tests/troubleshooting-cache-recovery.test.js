"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "troubleshooting", "index.html"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app", "troubleshooting", "troubleshooting-bootstrap.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function manifestEntries() {
  const match = html.match(/<script id="troubleshootingScriptManifest" type="application\/json">\s*([\s\S]*?)\s*<\/script>/);
  assert.ok(match, "troubleshooting script manifest missing");
  return JSON.parse(match[1]);
}

test("v363-or-later troubleshooting content keeps the v358 responsive bootstrap shell", () => {
  const versionMatch = /data-troubleshooting-version="v(\d+)"/.exec(html);
  assert.ok(versionMatch, "troubleshooting version banner missing");
  assert.ok(Number(versionMatch[1]) >= 363, `expected v363 or later, got v${versionMatch?.[1]}`);
  assert.match(html, /Preparing diagnostic bootstrap/);
  const executableScripts = [...html.matchAll(/<script(?![^>]*type="application\/json")[^>]*src="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(executableScripts, ["./troubleshooting-bootstrap.js?v=0.9.10&amp;build=troubleshooting-bootstrap-v358-20260904"]);
});

test("bootstrap preserves the complete current troubleshooting module order declaratively", () => {
  const entries = manifestEntries();
  assert.ok(entries.length >= 40, `expected full troubleshooting startup manifest, found ${entries.length}`);
  entries.forEach((src) => assert.match(src, /shell=v358/, `missing v358 shell key: ${src}`));
  const foundation = "./apl-cart-foundation.js?v=0.9.10&build=troubleshooting-apl-cart-foundation-v355-20260904&shell=v358";
  const web = "./apl-cart-web-handling.js?v=0.9.10&build=troubleshooting-apl-cart-web-handling-v361-20260904&shell=v358";
  const servo = "./apl-cart-servo-status.js?v=0.9.10&build=troubleshooting-apl-cart-servo-status-v362-20260904&shell=v358";
  const tail = "./apl-cart-tail-status.js?v=0.9.10&build=troubleshooting-apl-cart-tail-v363-20260904&shell=v358";
  const core = "./apl-cart-core-status.js?v=0.9.10&build=troubleshooting-apl-cart-core-v364-20260905&shell=v358";
  const sourceBridge = "./topmodul-live-00067-source-bridge.js?v=0.9.10&build=troubleshooting-live-00067-v347-20260904-0645&shell=v358";
  const exactSearch = "./troubleshooting-search-precedence.js?v=0.9.10&build=troubleshooting-search-precedence-v360-20260904&shell=v358";
  const guard = "./troubleshooting-startup-guard.js?v=0.9.10&build=troubleshooting-startup-v356-20260904&shell=v358";
  const controller = "./troubleshooting-app.js?v=0.9.10&build=troubleshooting-exact-circuit-v329-20260903-1920&shell=v358";
  assert.ok(entries.indexOf(foundation) < entries.indexOf(web));
  assert.ok(entries.indexOf(web) < entries.indexOf(servo));
  assert.ok(entries.indexOf(servo) < entries.indexOf(tail));
  assert.ok(entries.indexOf(tail) < entries.indexOf(core));
  assert.ok(entries.indexOf(core) < entries.indexOf(sourceBridge));
  assert.ok(entries.indexOf(sourceBridge) < entries.indexOf(exactSearch));
  assert.ok(entries.indexOf(exactSearch) < entries.indexOf(guard));
  assert.ok(entries.indexOf(guard) < entries.indexOf(controller));
  assert.equal(entries.at(-1).startsWith("./apl-cart-tail-status-ui.js"), true);
});

test("bootstrap yields a paint before each module executes and exposes the active filename", () => {
  assert.match(bootstrap, /Starting diagnostics \$\{index \+ 1\}\/\$\{manifest\.length\}: \$\{filename\(src\)\}/);
  assert.match(bootstrap, /await nextPaint\(\);/);
  assert.match(bootstrap, /requestAnimationFrame/);
  assert.match(bootstrap, /await loadScript\(src\);/);
  assert.match(bootstrap, /Startup file timed out/);
  assert.match(bootstrap, /Startup error in/);
});

test("bootstrap preserves a controller PASS while later UI modules continue loading", () => {
  assert.match(bootstrap, /interfaceReady:\s*false/);
  assert.match(bootstrap, /readyMessage:\s*""/);
  assert.match(bootstrap, /function captureInterfaceReady\(\)/);
  assert.match(bootstrap, /element\.dataset\.status !== "pass"/);
  assert.match(bootstrap, /state\.interfaceReady = true/);
  assert.match(bootstrap, /function setProgress\(message\)/);
  assert.match(bootstrap, /captureInterfaceReady\(\);\s*setStatus\(message, "loading"\)/);
  assert.match(bootstrap, /function restoreReadyStatus\(\)/);
  assert.match(bootstrap, /setStatus\(state\.readyMessage \|\| "Troubleshooting interface ready\.", "pass"\)/);
  assert.match(bootstrap, /if \(restoreReadyStatus\(\)\) return;/);
});

test("cache repair remains scoped to service workers and ServoForge caches", () => {
  assert.match(bootstrap, /registration\.unregister\(\)/);
  assert.match(bootstrap, /name\.startsWith\(CACHE_PREFIX\)/);
  assert.match(bootstrap, /caches\.delete\(name\)/);
  assert.doesNotMatch(bootstrap, /localStorage\.clear|indexedDB\.deleteDatabase/);
  assert.match(bootstrap, /cacheRepair", "v359"/);
});

test("offline shell carries the v358 bootstrap instead of the stale v329 cache generation", () => {
  assert.match(serviceWorker, /CACHE_NAME = "servoforge-labeler-staging-v0\.9\.10-troubleshooting-bootstrap-v358-20260904"/);
  assert.match(serviceWorker, /\.\/app\/troubleshooting\/troubleshooting-bootstrap\.js/);
});
