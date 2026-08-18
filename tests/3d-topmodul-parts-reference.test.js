"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const bootstrap = read("app/bootstrap.js");
const source = read("app/3d/topmodul-parts-reference.js");

const referenceIndex = bootstrap.indexOf("app/3d/topmodul-parts-reference.js");
const catalogIndex = bootstrap.indexOf("app/3d/hardware-reference-catalog.js");
assert.ok(referenceIndex >= 0, "TopModul parts reference must be bootstrap-loaded.");
assert.ok(catalogIndex > referenceIndex, "Manual-backed reference must load before the hardware catalog.");

const sandbox = { window: {}, console, Object, Array, Number, String, Boolean };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
assert.doesNotThrow(() => vm.runInContext(source, sandbox, { filename: "app/3d/topmodul-parts-reference.js" }));

const reference = sandbox.Labeler3DTopModulPartsReference;
assert.ok(reference);
assert.strictEqual(reference.REFERENCE_VERSION, "servoforge.topmodul-parts-reference.v1");
assert.strictEqual(reference.status().documentCount, 8);
assert.strictEqual(reference.status().dimensionsAutomaticallyAuthoritative, false);

const arm = reference.assembly("abLabelApplicationArm");
assert.strictEqual(arm.drawingReference, "0-900-588-044");
assert.ok(arm.confirmedParts.includes("application wedge"));
assert.ok(arm.confirmedParts.includes("sprocket idler L=119"));
assert.ok(arm.confirmedParts.includes("AB stop photoelectric sensor assembly"));

const wedge = reference.assembly("applicationWedge");
assert.strictEqual(wedge.drawingReference, "0-900-585-924");
assert.ok(wedge.confirmedParts.includes("guide plate"));
assert.ok(wedge.confirmedParts.includes("infeed housing"));
assert.ok(wedge.confirmedParts.includes("mounting plate"));
assert.match(wedge.variantNote, /keep variants distinct/i);

const applicator = reference.assembly("labelApplicatorHead");
assert.strictEqual(applicator.drawingReference, "0-900-571-103");
assert.ok(applicator.confirmedParts.includes("actuation device"));

const handling = reference.assembly("handlingStarWheels");
assert.match(handling.designation, /STAR WHEEL/);
assert.strictEqual(handling.manual, "handling");

console.log("ServoForge TopModul manual-backed parts reference regression passed.");
