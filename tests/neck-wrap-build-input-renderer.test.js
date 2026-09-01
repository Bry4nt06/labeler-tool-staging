"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app/build-inputs-renderer.js"), "utf8");
const label = {
  brand: "Full Wrap Test",
  bodyLengthMm: 70,
  backLengthMm: 50,
  neckBottomCurveMm: 104,
  neckBottomCircumferenceMm: 100
};
const buildInputs = {
  neckContactMm: 0,
  bodyContactMm: 0,
  backContactMm: 0,
  centerLineFrontDeg: 0,
  neckApplication: "Center",
  neckSpenderPlateDeg: 0,
  plateStartPositionDeg: 0,
  neckOverWipeDeg: 0,
  bodyOverWipeDeg: 0,
  backOverWipeDeg: 0,
  neckOffsetMm: 0,
  bodyOffsetMm: 0,
  backOffsetMm: 0,
  backInspectionOffsetMm: 0
};
const target = { innerHTML: "" };
let wrapPlan = {
  requestedType: "auto",
  detection: "overlap-candidate",
  resolvedMode: "full-wrap-overlap",
  calculatedWrapAngleDeg: 374.4,
  calculatedOverlapMm: 4,
  calculatedOverlapDeg: 14.4,
  overlapEdge: null,
  underlyingEdge: null,
  hasOverlapTargetOverride: false,
  targetOverlapMm: 4,
  targetOverlapDeg: 14.4,
  seamWipeEnabled: true,
  seamOverWipeDeg: 5,
  fullWrapReady: false
};
const context = {
  console,
  state: {
    applicationMode: "cold-glue",
    bottleSpecs: [],
    buildInputs,
    maxMoveRatio: 21,
    headCount: 16,
    autoScaleTableMap: false,
    referencePitchRadiusMm: 1,
    tablePitchRadiusMm: 1,
    encoderCountsPerRev: 1,
    servoGearRatio: 1,
    selectedZone: "Zone",
    selectedSite: "Site",
    selectedBrand: label.brand,
    selectedBottle: "Bottle"
  },
  els: { buildInputs: target },
  ensureSelectedZoneAndSite() {},
  labelSpecsForApplication: () => [label],
  buildProgramSummary: () => ({ label, bottle: null, rows: [] }),
  bodyCircumference: () => 200,
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  degFromMm: (length, circumference) => Number(length) / Number(circumference) * 360,
  fmt: (value, digits = 1) => Number(value).toFixed(digits),
  selectedNeckWrapPlan: () => wrapPlan,
  zoneNames: () => ["Zone"],
  sitesForZone: () => ["Site"],
  optionList: (items) => items.map((item) => `<option>${item}</option>`).join("")
};
context.window = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "build-inputs-renderer.js" });

context.renderBuildInputs();
assert.ok(target.innerHTML.indexOf('id="programNeckLabelDeg"') < target.innerHTML.indexOf('id="neckWrapType"'),
  "Neck Wrap must render directly after the neck-label length in Label & Bottle Geometry");
assert.match(target.innerHTML, /Full neck wrap detected/);
assert.match(target.innerHTML, /id="neckOverlapEdge"/);
assert.match(target.innerHTML, /Leading Edge on Top/);
assert.match(target.innerHTML, /Trailing Edge on Top/);
assert.match(target.innerHTML, /id="neckSeamWipeEnabled"[^>]*checked/);

wrapPlan = { ...wrapPlan, detection: "standard", resolvedMode: "standard", calculatedWrapAngleDeg: 180 };
context.renderBuildInputs();
assert.match(target.innerHTML, /id="neckWrapType"/);
assert.doesNotMatch(target.innerHTML, /id="neckOverlapEdge"/,
  "overlap-only controls must stay collapsed for a standard neck label");

context.state.applicationMode = "apl";
context.renderBuildInputs();
assert.doesNotMatch(target.innerHTML, /id="neckWrapType"/,
  "Cold Glue overlap controls must not clutter the APL setup");

console.log("Neck-wrap Build Inputs placement and conditional display regression passed.");
