"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const renderer = fs.readFileSync(
  path.resolve(__dirname, "../app/specification-table-renderer.js"),
  "utf8"
);

for (const header of [
  "Dia Target",
  "Radius Red.",
  "Body/Back Dia",
  "Body/Back Circ",
  "Body L",
  "Back L",
  "Neck Ht",
  "Neck L",
  "Neck Curve",
  "Neck Circ",
  "Code Box Ctr"
]) {
  assert.match(renderer, new RegExp(`specificationInfoHeader\\(\\"${header.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\"`), `${header} must use an information header.`);
}

assert.doesNotMatch(renderer, /Body Lgth/);
assert.doesNotMatch(renderer, /Back Lgth/);
assert.doesNotMatch(renderer, /Neck Lgth/);
assert.doesNotMatch(renderer, />Spec #</);
assert.match(renderer, /class=\"info-tip spec-header-info\"/);
assert.match(renderer, /Body label length in mm/);
assert.match(renderer, /Back label length in mm/);
assert.match(renderer, /Target bottle diameter in mm/);

console.log("Specs compact information-header regression passed.");
