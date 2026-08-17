"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const loader = read("app/profile-generation.js");
const aplSeed = read("app/apl-seed-profile.js");
const coldGlue = read("app/cold-glue-profile-generation.js");
const coldGlueDriver = read("drivers/mechanical/cold-glue-motion-driver.js");
const aplMap = read("app/apl-map-profile-generation.js");
const routing = read("app/profile-routing.js");
const framing = read("app/machine-profile-framing.js");
const overrides = read("app/servo-overrides.js");
const translation = read("app/profile-translation-service.js");
const translationValidation = read("app/profile-translator-validation.js");
const translatorUi = read("app/profile-translator-integration.js");
const app = read("app.js");
const serviceWorker = read("service-worker.js");

const expectedModules = [
  "app/apl-seed-profile.js",
  "app/cold-glue-profile-generation.js",
  "app/apl-map-profile-generation.js",
  "app/profile-routing.js",
  "app/machine-profile-framing.js",
  "app/servo-overrides.js",
  "app/profile-translation-service.js",
  "app/profile-translator-validation.js"
];
expectedModules.forEach((modulePath) => assert.match(loader, new RegExp(modulePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

assert.doesNotMatch(app, /function generatedAplSeedProfile\(/);
assert.doesNotMatch(app, /function generatedAplTwoLabelProfile\(/);
assert.doesNotMatch(app, /function generatedColdGlueFixedProfile\(/);
assert.doesNotMatch(app, /function generatedAplMapDrivenProfile\(/);
assert.doesNotMatch(app, /function generatedServoProfile\(/);
assert.doesNotMatch(app, /function applyMachineTypeProfileFraming\(/);
assert.doesNotMatch(app, /function applyGeneratedServoProfile\(/);
assert.doesNotMatch(app, /function servoOverrideProfileKey\(/);
assert.doesNotMatch(app, /function setServoAngleOverride\(/);
assert.doesNotMatch(app, /function buildAndTranslateProgram\(/);

assert.match(aplSeed, /function generatedAplSeedProfile\(/);
assert.match(aplSeed, /function generatedAplTwoLabelProfile\(/);
assert.match(coldGlue, /function generatedColdGlueFixedProfile\(/);
assert.match(aplMap, /function generatedAplMapDrivenProfile\(/);
assert.match(routing, /function generatedServoProfile\(/);
assert.match(framing, /function applyMachineTypeProfileFraming\(/);
assert.match(overrides, /function applyGeneratedServoProfile\(/);
assert.match(overrides, /function servoOverrideProfileKey\(/);
assert.match(overrides, /function setServoAngleOverride\(/);
assert.match(translation, /function buildAndTranslateProgram\(/);
assert.match(translation, /motionEventId/);
assert.match(translationValidation, /translatorAwareValidation/);
assert.match(translatorUi, /persistMotionProfileSelection/);
assert.doesNotMatch(translatorUi, /buildAndTranslateProgram|syncTranslatedRows|TRANSLATOR_RELEASE_VERSION/);

const activeProfileSources = [aplSeed, coldGlue, aplMap, routing, framing, overrides, translation].join("\n");
const exactlyOnce = [
  "generatedAplSeedProfile",
  "generatedAplTwoLabelProfile",
  "generatedColdGlueFixedProfile",
  "generatedAplMapDrivenProfile",
  "generatedServoProfile",
  "applyMachineTypeProfileFraming",
  "applyGeneratedServoProfile",
  "servoOverrideProfileKey",
  "setServoAngleOverride",
  "buildAndTranslateProgram"
];
exactlyOnce.forEach((name) => {
  const definitions = activeProfileSources.match(new RegExp(`function ${name}\\(`, "g")) || [];
  assert.equal(definitions.length, 1, `${name} must have exactly one active definition`);
});

assert.match(aplSeed, /requiredPairExitPadding/);
assert.match(aplSeed, /apl-two-label-reference/);
assert.match(coldGlue, /cold-glue-machine-map/);
assert.match(coldGlue, /cold-glue-empty-map/);
assert.match(coldGlueDriver, /cold-glue-channel-capacity/);
assert.match(coldGlueDriver, /createBrushChannelPlan/);
assert.match(aplMap, /apl-machine-map/);
assert.match(aplMap, /apl-long-neck-adaptive-wipe/);
assert.match(aplMap, /codingMotion: "direct-shortest-path"/);
assert.match(serviceWorker, /profile-translation-ownership-v1/);

console.log("Separated profile family boundary regression passed.");
