"use strict";

const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

const renderer = read("app/3d/three-scene-renderer-v08.js");
const viewport = read("app/3d/bottle-handling-viewport-integration.js");
const progressive = read("app/3d/bottle-handling-progressive-label-flow-integration.js");
const bootstrap = read("app/bootstrap.js");

test("one WebGL renderer owns one canonical starwheel scene", () => {
  assert.equal((renderer.match(/new THREE\.WebGLRenderer/g) || []).length, 1);
  assert.equal((renderer.match(/new THREE\.Scene\(/g) || []).length, 1);
  assert.match(renderer, /ServoForgeCanonicalBottleHandlingScene/);
  assert.match(renderer, /starwheel-bottle-handling-only/);
  assert.match(renderer, /legacyCarouselEnvironment = false/);
  assert.match(renderer, /await handlingViewport\(\)\.attachScene\(scene\)/);
});

test("retired generic carousel and head environment cannot be constructed", () => {
  [
    /ServoForgeBottleTablePopulation/,
    /function createHeadAssembly/,
    /function rebuildHeads/,
    /carouselBody\s*=/,
    /carouselTop\s*=/,
    /pathRing\s*=/,
    /hub\s*=/
  ].forEach((pattern) => assert.doesNotMatch(renderer, pattern));
});

test("bottle handling owns starwheels, conveyors and the complete bottle route", () => {
  assert.match(viewport, /ServoForgeBottleHandlingSystem/);
  assert.match(viewport, /ServoForgeInfeedStar/);
  assert.match(viewport, /ServoForgeIntermediateStar/);
  assert.match(viewport, /ServoForgeDischargeStar/);
  assert.match(viewport, /ServoForgeInfeedConveyor/);
  assert.match(viewport, /ServoForgeOutfeedConveyor/);
  assert.match(viewport, /bottlePopulationAuthority: "continuous-handling-route-only"/);
  assert.match(viewport, /legacySingleBottlePopulation: false/);
  assert.match(viewport, /singleSceneAuthority: true/);
});

test("active 3D layers do not discover scenes by monkey-patching Three.js", () => {
  [viewport, progressive].forEach((source) => {
    assert.doesNotMatch(source, /Object3D\?*\.prototype/);
    assert.doesNotMatch(source, /prototype\.add\s*=/);
    assert.doesNotMatch(source, /requestAnimationFrame\s*\(/);
  });
  assert.match(viewport, /prototypeSceneHook: false/);
  assert.match(progressive, /prototypeSceneHook: false/);
});

test("legacy presentation authorities are deleted and not bootstrap-loaded", () => {
  const retired = [
    "app/3d/bottle-handling-measured-star-presentation-integration.js",
    "app/3d/bottle-handling-photo-presentation-integration.js",
    "app/3d/bottle-handling-pocket-phase-presentation-integration.js",
    "app/3d/bottle-handling-pocket-clearance-label-restore-integration.js",
    "app/3d/bottle-handling-progressive-label-authority-integration.js",
    "app/3d/three-d-direction-parity-presentation-integration.js",
    "app/3d/dashboard-top-view-parity-integration.js",
    "app/3d/bottle-handling-unified-star-height-thickness-integration.js",
    "app/3d/bottle-handling-rounded-pocket-inner-hub-integration.js",
    "app/3d/bottle-handling-visible-inner-hub-integration.js"
  ];
  retired.forEach((file) => {
    assert.equal(exists(file), false, `${file} must remain retired`);
    assert.equal(bootstrap.includes(file), false, `${file} must not return to bootstrap`);
  });
});
