"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const bootstrap = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const startup = fs.readFileSync(path.join(root, "app.js"), "utf8");
const policy = fs.readFileSync(
  path.join(root, "app", "topmodul-coder-terminal-source-policy-integration.js"),
  "utf8"
);

// This test used to assert a synthetic 299° pre-coder stop. That requirement
// was incorrect. The physical APL 6-Aggregate coder begins at 304°, and v52
// makes 304° the authoritative terminal destination inside the generation
// pipeline before grammar derives CMD 3/7 ownership.
assert.doesNotMatch(bootstrap, /topmodul-coder-prehold-finalizer-integration\.js/);
assert.match(bootstrap, /topmodul-coder-terminal-source-policy-integration\.js/);
assert.match(startup, /TopModul coder terminal source policy/);
assert.match(startup, /topmodul-coder-terminal-source-policy-integration\.js/);
assert.match(policy, /STAGE_ORDER = 550/);
assert.match(policy, /preCoderMarginDeg: 0/);
assert.match(policy, /tableAngle: done\(coderStart\)/);
assert.match(policy, /terminalRest: true/);

console.log("Obsolete 299° pre-coder finalizer is retired; physical 304° coder terminal policy owns the generated program.");
