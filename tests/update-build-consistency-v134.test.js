"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const persistence = fs.readFileSync(path.join(root, "app/persistence.js"), "utf8");

const build = String(manifest.buildId || "").trim();
assert.ok(build, "update manifest must publish a buildId");
const escapedBuild = build.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

assert.match(
  bootstrap,
  new RegExp(`const build = [\"']${escapedBuild}[\"']`),
  "bootstrap build must match the update-manifest buildId"
);
assert.match(
  serviceWorker,
  new RegExp(escapedBuild),
  "service-worker cache boundary must include the published buildId"
);

const installBlock = serviceWorker.match(/self\.addEventListener\("install",[\s\S]*?\n\}\);/)?.[0] || "";
assert.doesNotMatch(
  installBlock,
  /skipWaiting\s*\(/,
  "a newly downloaded worker must not replace the active worker during a running session"
);
assert.match(
  serviceWorker,
  /type === "SKIP_WAITING"[\s\S]*?self\.skipWaiting\(\)/,
  "explicit Restart to Update activation must remain available"
);
assert.match(
  persistence,
  /let reloadRequestedForServiceWorker = false;/,
  "the update runtime must track explicit restart intent"
);
assert.match(
  persistence,
  /if \(!reloadRequestedForServiceWorker \|\| reloadingForServiceWorker\) return;/,
  "controller changes must not automatically reload a running staging session"
);
assert.match(
  persistence,
  /reloadRequestedForServiceWorker = true;\s*pendingServiceWorker\.postMessage\(\{ type: "SKIP_WAITING" \}\)/,
  "Restart to Update must opt into the one controller-change reload"
);

// app.js normally receives the build from bootstrap. Its older fallback may
// remain for recovery, but it must not independently force reload behavior.
assert.doesNotMatch(app, /window\.location\.reload\(\)/,
  "the application bootstrap must not contain an independent reload loop");

console.log("Update delivery stability regression passed.");
