"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

const build = String(manifest.buildId || "").trim();
assert.ok(build, "update manifest must publish a buildId");
assert.match(bootstrap, new RegExp(`const build = [\"']${build.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\"']`),
  "bootstrap build must match update-manifest buildId or automatic update checks can reload forever");
assert.match(app, new RegExp(`const build = [\"']${build.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\"']`),
  "app runtime build must match update-manifest buildId");
assert.match(serviceWorker, new RegExp(build.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  "service-worker cache boundary must include the published buildId");

console.log("Update build consistency v134 regression passed.");
