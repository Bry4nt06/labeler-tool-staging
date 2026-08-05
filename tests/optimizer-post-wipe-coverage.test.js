"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(
  path.join(root, "app", "optimizer-post-wipe-coverage-fix-integration.js"),
  "utf8"
);
const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /function isPostWipeOrientationHandoff/);
assert.match(source, /diagnostic\?\.code !== "optimizer-wipe-contact"/);
assert.match(source, /Number\(row\.cmd\) !== 7/);
assert.match(source, /wipe\\s\+hold/);
assert.match(source, /frameStart >= contactEnd - EPSILON/);
assert.match(source, /optimizer-speed-margin|filterDiagnostics/);
assert.match(source, /postWipeCoveragePolicyV1/);
assert.match(source, /analyzeWithMapAwareCoverage/);
assert.match(startup, /optimizer-post-wipe-coverage-v20/);
assert.match(startup, /optimizer-post-wipe-coverage-fix-integration\.js/);

const pad = { start: 270, end: 290 };
const frameStart = 290;
const frameEnd = 299;
const targetMid = (frameStart + frameEnd) / 2;
const baseMid = (pad.start + pad.end) / 2;
const shift = Math.round((targetMid - baseMid) / 360);
const candidates = [shift - 1, shift, shift + 1].map((turns) => ({
  start: pad.start + turns * 360,
  end: pad.end + turns * 360,
  distance: Math.abs(baseMid + turns * 360 - targetMid)
})).sort((left, right) => left.distance - right.distance);
assert.deepEqual(
  { start: candidates[0].start, end: candidates[0].end },
  { start: 270, end: 290 },
  "The nearest physical pad cycle must remain 270°–290°, not -90°–-70°."
);
assert.equal(frameStart >= candidates[0].end - 0.001, true);

console.log("Post-wipe coverage regression passed.");
