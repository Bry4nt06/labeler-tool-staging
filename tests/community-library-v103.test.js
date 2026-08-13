"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const integration = fs.readFileSync(path.join(root, "app/community-library-v103-integration.js"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");

assert.ok(integration.includes('select.id = "communityZoneFilter"'), "Zone browse filter must exist.");
assert.ok(integration.includes('Zone: All'), "Zone filter must include All.");
assert.ok(integration.includes('select.id = "communitySiteFilter"'), "Site browse filter must exist.");
assert.ok(integration.includes('Site: All'), "Site filter must include All.");
assert.ok(integration.includes('maxlength="3"'), "Community Zone/Site upload inputs must be capped at 3 characters.");
assert.ok(integration.includes('.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3)'), "Community location codes must normalize to uppercase alphanumeric values capped at three characters.");

for (const source of ["mapLibrary", "bottleSpecs", "labelSpecs"]) {
  assert.ok(integration.includes(source), `Upload selectors must read ${source} from the saved workspace.`);
}
for (const control of ["communityUploadMapSelect", "communityUploadBottleSelect", "communityUploadBrandSelect"]) {
  assert.ok(integration.includes(control), `Upload selector missing: ${control}`);
}
assert.ok(integration.includes('form.addEventListener("submit", submitSelectedPackage, true)'), "v103 upload handler must run in capture mode before the legacy current-selection submit handler.");
assert.ok(integration.includes("communityZone: zone"));
assert.ok(integration.includes("communitySite: site"));
assert.ok(integration.includes("grid-template-columns:minmax(220px,1fr) 108px 108px 150px auto"), "Browse toolbar should use the compact five-control layout.");
assert.ok(integration.includes(".sf-community-card{padding:9px 10px"), "Community cards should use compact spacing.");
assert.ok(integration.includes('document.addEventListener("DOMContentLoaded", bind, { once: true })'), "Community v103 must wait for the base Community dialog on fresh page loads.");

const baseIndex = bootstrap.indexOf('"app/community-library-integration.js"');
const v103Index = bootstrap.indexOf('"app/community-library-v103-integration.js"');
assert.ok(baseIndex >= 0 && v103Index > baseIndex, "Community v103 enhancements must load after the base Community Library module.");

assert.ok(!integration.includes("map.zone ="), "Community location metadata must not mutate machine-map zone identity.");
assert.ok(!integration.includes("map.site ="), "Community location metadata must not mutate machine-map site identity.");

console.log("Community Library v103 compact filters and saved-spec upload regression passed.");
