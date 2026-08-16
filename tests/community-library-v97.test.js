"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const community = fs.readFileSync(path.join(root, "app/community-library-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const updater = fs.readFileSync(path.join(root, "app/update-manager.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));
const BUILD = String(manifest.buildId || "").trim();
assert.ok(BUILD, "Current staging build id must be available.");

assert.match(community, /servoforge-community/);
assert.match(community, /Browse/);
assert.match(community, /Upload/);
assert.match(community, /My Uploads/);
assert.match(community, /Community Admin/);
assert.match(community, /Complete Setup/);
assert.match(community, /maxlength="200"/);
assert.match(community, /Submit for Review/);
assert.match(community, /data-community-import="add"/);
assert.match(community, /data-community-import="replace"/);
assert.match(community, /__proto__/);
assert.match(community, /prototype/);
assert.match(community, /constructor/);
assert.match(community, /community_package|Community package|Community Package/i);
assert.doesNotMatch(community, /\beval\s*\(/);
assert.doesNotMatch(community, /new Function\s*\(/);

const feedbackIndex = bootstrap.indexOf('"app/feedback-center-integration.js"');
const communityIndex = bootstrap.indexOf('"app/community-library-integration.js"');
assert.ok(feedbackIndex >= 0 && communityIndex > feedbackIndex, "Community Library must load after Feedback identity is installed.");

for (const label of ["Export Settings", "Import Settings", "Export JSON", "Import Fault JSON", "Export CSV"]) {
  assert.ok(!index.includes(`>${label}<`) && !index.includes(`${label}<input`), `${label} must be removed from staging Settings HTML.`);
}
for (const label of ["Download Brands", "Import Map JSON", "Import Fault Limits"]) assert.ok(community.includes(`"${label}"`));

const escapedBuild = BUILD.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const source of [bootstrap, index, sw, updater, app]) assert.match(source, new RegExp(escapedBuild));
console.log("Community Library v97 and staging Settings cleanup regression passed.");
