"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const source = read("app/3d/bottle-handling-progressive-label-flow-integration.js");
const bootstrap = read("app/bootstrap.js");

test("progressive bottle labeling follows active program sections and Head 1 application angles", () => {
  assert.match(source, /activeProgramSections/);
  assert.match(source, /active-servoforge-program-sections-plus-head1-application-angles/);
  assert.match(source, /head1ReferenceAuthority: true/);
  assert.match(source, /programSectionAuthority: true/);
  ["NECK", "BODY", "FRONT", "BACK"].forEach((section) => {
    assert.ok(source.includes(`\\b${section}\\b`));
  });
});

test("handling bottles are unlabeled before carousel and fully settled after carousel", () => {
  assert.match(source, /PRE_CAROUSEL_OWNERS/);
  assert.match(source, /POST_CAROUSEL_OWNERS/);
  assert.match(source, /if \(PRE_CAROUSEL_OWNERS\.has\(owner\)\) return 0/);
  assert.match(source, /if \(POST_CAROUSEL_OWNERS\.has\(owner\)\) return 1/);
  assert.match(source, /owner !== "carousel"/);
});

test("each label uses a short smooth application animation rather than appearing fully wrapped", () => {
  assert.match(source, /progressiveWrapAnimation: true/);
  assert.match(source, /activeRuntime\.latestSnapshot\?\.\(\) \|\| activeRuntime\.snapshot\(/);
  assert.match(source, /coordinator\.register\(INTEGRATION_VERSION, renderFrame, \{ minIntervalMs: 0 \}\)/);
  assert.match(source, /animationWindowDegrees/);
  assert.match(source, /applicationState = p <= 0\.001 \? "unapplied" : p >= 0\.999 \? "applied" : "wrapping"/);
  assert.match(source, /mesh\.rotation\.y/);
  assert.match(source, /mesh\.scale\.set/);
  assert.match(source, /mesh\.material\.opacity/);
});

test("progressive label flow stays read-only with respect to servo and planner state", () => {
  assert.match(source, /servoWrites: false/);
  assert.match(source, /plannerWrites: false/);
  [
    /state\.program\s*=/,
    /simulation\.lines\s*=/,
    /setServoAngleOverride\s*\(/,
    /buildPlannerMotion\s*\(/,
    /saveCurrentSettings\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(source, pattern));
});

test("progressive label flow loads after I-heart-Beer polish and before scene runtime", () => {
  const polishIndex = bootstrap.indexOf('"app/3d/bottle-label-coder-visual-polish-integration.js"');
  const flowIndex = bootstrap.indexOf('"app/3d/bottle-handling-progressive-label-flow-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(polishIndex >= 0);
  assert.ok(flowIndex > polishIndex);
  assert.ok(runtimeIndex > flowIndex);
});
