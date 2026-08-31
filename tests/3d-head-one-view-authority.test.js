"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const authoritySource = read("app/3d/head-one-view-authority-integration.js");
const measuredStarSource = read("app/3d/bottle-handling-measured-star-layout-integration.js");
const equipmentSource = read("app/3d/equipment-layout-adapter.js");

function installAuthority() {
  const handling = {
    bottles: [
      { id: "transport-a", owner: "carousel", carrierHead: 7, position: { x: 1, z: 2 } },
      { id: "head-one-bottle", owner: "carousel", carrierHead: 1, position: { x: 3, z: 4 } },
      { id: "transport-b", owner: "intermediate-star", position: { x: 5, z: 6 } }
    ]
  };
  const baseViewport = {
    sync() { return true; },
    setBottleMode() { return "all"; },
    latestSnapshot() { return handling; },
    latestHandlingSnapshot() { return handling; },
    getLayer() { return null; },
    status() { return {}; }
  };
  const target = { window: {}, console, Object, Array, Number, String, Boolean, Math };
  target.window = target;
  target.Labeler3DBottleHandlingViewport = Object.freeze(baseViewport);
  vm.createContext(target);
  vm.runInContext(authoritySource, target, { filename: "head-one-view-authority-integration.js" });
  return target;
}

test("v307 Top View handling placement remains the locked geometry baseline", () => {
  assert.doesNotMatch(bootstrap, /bottle-handling-zero-position-authority-integration\.js/);
  assert.match(measuredStarSource, /ENTRY_TRANSFER_ANGLE_DEGREES = 30/);
  assert.match(measuredStarSource, /DISCHARGE_TRANSFER_ANGLE_DEGREES = 330/);
  assert.match(equipmentSource, /angularAuthority:\s*"active-machine-map"/);
});

test("Head 1 authority loads after viewport controls and before the renderer runtime", () => {
  const controls = bootstrap.indexOf('"app/3d/viewport-ui-controls-integration.js"');
  const headOne = bootstrap.indexOf('"app/3d/head-one-view-authority-integration.js"');
  const runtime = bootstrap.indexOf('"app/3d/scene-runtime.js"');
  assert.ok(controls >= 0);
  assert.ok(headOne > controls);
  assert.ok(runtime > headOne);
  assert.match(bootstrap, /head-one-view-stability-v308/);
});

test("Head 1 bottle identity is carrierHead 1, not the first carousel transport bottle", () => {
  const target = installAuthority();
  const api = target.Labeler3DHeadOneViewAuthority;
  assert.equal(api.carrierHeadOneIndex({
    bottles: [
      { owner: "carousel", carrierHead: 9 },
      { owner: "carousel", carrierHead: 1 },
      { owner: "carousel", carrierHead: 2 }
    ]
  }), 1);
});

test("camera tracking snapshot is anchored to physical carousel Head 1 for the full revolution", () => {
  const target = installAuthority();
  target.Labeler3DBottleHandlingViewport.sync({
    carousel: {
      heads: [
        { head: 1, tableAngleDegrees: 287.4, position: { x: 8.25, y: 0, z: -2.5 } },
        { head: 2, tableAngleDegrees: 279.4, position: { x: 7.9, y: 0, z: -3.0 } }
      ]
    }
  });
  const tracking = target.Labeler3DBottleHandlingViewport.latestSnapshot();
  assert.equal(tracking.bottles[0].trackingOnly, true);
  assert.equal(tracking.bottles[0].carrierHead, 1);
  assert.equal(tracking.bottles[0].tableAngleDegrees, 287.4);
  assert.equal(tracking.bottles[0].position.x, 8.25);
  assert.equal(tracking.bottles[0].position.z, -2.5);
  assert.equal(tracking.bottles[1].carrierHead, 7);
});

test("Head 1 view authority does not change geometry, animation state, or renderer prototypes", () => {
  assert.match(authoritySource, /geometryUntouched:\s*true/);
  assert.match(authoritySource, /rendererFrameLoopUntouched:\s*true/);
  [
    /Object3D\.prototype/,
    /prototype\.add\s*=/,
    /state\.program\s*=/,
    /state\.direction\s*=/,
    /saveCurrentSettings\s*\(/,
    /requestAnimationFrame\s*\(/
  ].forEach((pattern) => assert.doesNotMatch(authoritySource, pattern));
});
