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
  assert.match(source, /\bNECK\b/);
  assert.match(source, /\bBODY\b\|\\bFRONT/);
  assert.match(source, /\bBACK\b/);
});

test("handling bottles are unlabeled before carousel and settled after carousel", () => {
  assert.match(source, /PRE_CAROUSEL_OWNERS/);
  assert.match(source, /POST_CAROUSEL_OWNERS/);
  assert.match(source, /PRE_CAROUSEL_OWNERS\.has\(owner\)/);
  assert.match(source, /POST_CAROUSEL_OWNERS\.has\(owner\)/);
  assert.match(source, /owner !== "carousel"/);
});

test("label application remains progressive and read only", () => {
  assert.match(source, /progressiveWrapAnimation: true/);
  assert.match(source, /animationWindowDegrees/);
  assert.match(source, /applicationState/);
  assert.match(source, /mesh\.rotation\.y/);
  assert.match(source, /mesh\.scale\.set/);
  assert.match(source, /mesh\.material\.opacity/);
  assert.match(source, /servoWrites: false/);
  assert.match(source, /plannerWrites: false/);
  assert.doesNotMatch(source, /state\.program\s*=/);
  assert.doesNotMatch(source, /setServoAngleOverride\s*\(/);
});

test("progressive labels attach explicitly and share the presentation frame", () => {
  assert.match(source, /function attachLayer\(candidate\)/);
  assert.match(source, /ServoForgeBottleHandlingSystem/);
  assert.match(source, /coordinator\.register\(INTEGRATION_VERSION, renderFrame/);
  assert.match(source, /independentAnimationLoop: false/);
  assert.match(source, /prototypeSceneHook: false/);
  assert.doesNotMatch(source, /Object3D\?*\.prototype/);
  assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
});

test("progressive label flow loads after bottle visual polish and before scene runtime", () => {
  const polishIndex = bootstrap.indexOf('"app/3d/bottle-label-coder-visual-polish-integration.js"');
  const flowIndex = bootstrap.indexOf('"app/3d/bottle-handling-progressive-label-flow-integration.js"');
  const runtimeIndex = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(polishIndex >= 0);
  assert.ok(flowIndex > polishIndex);
  assert.ok(runtimeIndex > flowIndex);
});
