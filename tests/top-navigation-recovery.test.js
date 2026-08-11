"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "controllers", "tabs-controller.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /navigationCaptureV3:\s*true/);
assert.match(source, /setDirectTabState/);
assert.match(source, /stopImmediatePropagation/);
assert.match(index, /app\/controllers\/tabs-controller\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(index, /app\/bootstrap\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(index, /app\/update-manager\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(index, /app\.js\?v=0\.9\.10-bootstrap-independent-navigation-v69-20260811-1305/);
assert.match(bootstrap, /bootstrap-independent-navigation-v69-20260811-1305/);
assert.doesNotMatch(bootstrap, /"app\/controllers\/tabs-controller\.js"/);
assert.match(serviceWorker, /servoforge-labeler-staging-v0\.9\.10-bootstrap-independent-navigation-v69/);

const navIndex = index.indexOf("app/controllers/tabs-controller.js");
const driverIndex = index.indexOf("drivers/geometry/label-geometry-driver.js");
const bootstrapIndex = index.indexOf("app/bootstrap.js");
assert.ok(navIndex >= 0, "Direct navigation script must exist.");
assert.ok(navIndex < driverIndex, "Navigation controller must load before application drivers.");
assert.ok(navIndex < bootstrapIndex, "Navigation controller must load before bootstrap.");

console.log("Bootstrap-independent top navigation regression passed.");
