"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.match(source, /runtime-startup-animation-v54/,
  "Service worker cache must identify the v54 runtime startup repair.");
assert.match(source, /\.\/app\/runtime-context-bridge\.js/,
  "Offline cache must include the runtime context bridge.");
assert.match(source, /\.\/app\/map-overlay-builder-placement-integration\.js/,
  "Offline cache must include Map Overlay builder placement.");

const listMatch = source.match(/const CORE_ASSETS = Object\.freeze\(\[([\s\S]*?)\]\);/);
assert.ok(listMatch, "Unable to locate CORE_ASSETS in service-worker.js.");

const assets = [...listMatch[1].matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]);
assert.ok(assets.length > 100, `Expected the complete ServoForge core asset catalog, found ${assets.length}.`);

const missing = assets
  .filter((asset) => asset !== "./")
  .filter((asset) => !fs.existsSync(path.join(root, asset.slice(2))));

assert.deepEqual(missing, [], `Service worker references missing core assets: ${missing.join(", ")}`);
assert.equal(new Set(assets).size, assets.length, "CORE_ASSETS must not contain duplicate paths.");

console.log(`Service worker core asset regression passed (${assets.length} cached resources).`);
