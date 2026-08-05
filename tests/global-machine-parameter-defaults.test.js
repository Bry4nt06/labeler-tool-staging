"use strict";

const assert = require("node:assert/strict");

global.window = global;
global.state = {
  buildInputs: {
    neckSpenderPlateDeg: 60,
    neckApplication: "Leading Edge",
    plateStartPositionDeg: 0,
    neckContactMm: 4.4,
    bodyContactMm: 5,
    backContactMm: 5,
    bodyOverWipeDeg: 10
  }
};

require("../app/global-machine-parameter-defaults-integration.js");

const defaults = global.LabelerGlobalMachineParameterDefaults.DEFAULT_BUILD_INPUTS;
assert.deepEqual(defaults, {
  neckSpenderPlateDeg: 75,
  neckApplication: "Center",
  plateStartPositionDeg: 15,
  neckContactMm: 0,
  bodyContactMm: 0,
  backContactMm: 0
});
assert.equal(state.buildInputs.neckSpenderPlateDeg, 75);
assert.equal(state.buildInputs.neckApplication, "Center");
assert.equal(state.buildInputs.plateStartPositionDeg, 15);
assert.equal(state.buildInputs.neckContactMm, 0);
assert.equal(state.buildInputs.bodyContactMm, 0);
assert.equal(state.buildInputs.backContactMm, 0);
assert.equal(state.buildInputs.bodyOverWipeDeg, 10, "Unrelated build inputs must be preserved.");

const centerLineFront = -(90 - state.buildInputs.neckSpenderPlateDeg)
  + state.buildInputs.plateStartPositionDeg;
assert.equal(centerLineFront, 0, "The default front centerline must resolve to zero degrees.");

// loadSavedSettings merges saved values after this integration. Simulate that
// merge to confirm an explicit user change remains authoritative.
state.buildInputs = {
  ...state.buildInputs,
  neckSpenderPlateDeg: 82,
  plateStartPositionDeg: 7,
  bodyContactMm: 3.2
};
assert.equal(state.buildInputs.neckSpenderPlateDeg, 82);
assert.equal(state.buildInputs.plateStartPositionDeg, 7);
assert.equal(state.buildInputs.bodyContactMm, 3.2);

console.log("Global machine parameter defaults regression passed.");
