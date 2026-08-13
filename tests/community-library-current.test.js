"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const community = fs.readFileSync(path.join(root, "app/community-library-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const sw = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));

for (const feature of ["Browse", "Upload", "My Uploads", "Community Admin", "Complete Setup", "Submit for Review"]) {
  assert.ok(community.includes(feature), `Community feature missing: ${feature}`);
}
assert.ok(community.includes('maxlength="200"'));
assert.ok(community.includes('data-community-import="add"'));
assert.ok(community.includes('data-community-import="replace"'));

const feedbackIndex = bootstrap.indexOf('"app/feedback-center-integration.js"');
const communityIndex = bootstrap.indexOf('"app/community-library-integration.js"');
assert.ok(feedbackIndex >= 0 && communityIndex > feedbackIndex, "Community must load after Feedback identity.");
assert.ok(sw.includes("./app/community-library-integration.js"), "Community module must remain in the offline shell.");

for (const label of ["Export Settings", "Import Settings", "Export JSON", "Import Fault JSON", "Export CSV"]) {
  assert.ok(!index.includes(`>${label}<`) && !index.includes(`${label}<input`), `${label} must remain removed from Settings.`);
}
assert.equal(typeof manifest.buildId, "string");
assert.ok(manifest.buildId.length > 0);
console.log("Current Community Library and retired Settings controls regression passed.");
