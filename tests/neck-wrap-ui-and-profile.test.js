"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const renderer = read("app/build-inputs-renderer.js");
const controller = read("app/controllers/build-inputs-controller.js");
const events = read("app/controllers/setup-event-controller-integration.js");
const profile = read("app/cold-glue-profile-generation.js");
const validation = read("app/validation.js");
const summary = read("app/program-summary-service.js");
const styles = read("styles.css");

for (const id of ["neckWrapType", "neckOverlapEdge", "neckOverlapTargetMm", "neckSeamWipeEnabled", "neckSeamOverWipeDeg"]) {
  assert.match(renderer, new RegExp(`id=["']${id}["']`));
  assert.match(events, new RegExp(id));
}
assert.match(renderer, /Full neck wrap detected/);
assert.match(renderer, /Leading Edge on Top/);
assert.match(renderer, /Trailing Edge on Top/);
assert.match(renderer, /Calculated overlap/);
assert.match(renderer, /neck-wrap-preview/);
assert.match(controller, /updateNeckWrapSetting/);
assert.match(controller, /regenerate:\s*true/);
assert.match(profile, /wrapPlan:\s*section === "neck"/);
assert.match(profile, /Full Neck Wrap - First Edge Wipe/);
assert.match(profile, /Full Neck Wrap - Circumference Wipe/);
assert.match(profile, /Edge Crossing/);
assert.match(profile, /Full Neck Wrap - Seam Wipe/);
assert.match(profile, /Full Neck Wrap - Exit Rest/);
assert.match(validation, /selectedNeckWrapPlan/);
assert.match(summary, /Calculated Neck Overlap/);
assert.match(styles, /\.neck-wrap-overlap-controls/);

console.log("Neck-wrap controls, profile stages, preview, and diagnostics wiring regression passed.");
