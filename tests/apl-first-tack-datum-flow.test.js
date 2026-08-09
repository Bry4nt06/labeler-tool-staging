"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "apl-first-tack-datum-flow-integration.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /first physical label starts from the configured servo-start datum/);
assert.match(source, /Every later/);
assert.match(source, /repeat the same two wipe directions/);
assert.doesNotMatch(source, /Retrace the previous wipe path/);

const circumferenceMm = (60.68 - 0.6) * Math.PI;
const bodyLengthMm = 64.897;
const backLengthMm = 47.498;
const bodyDeg = bodyLengthMm / circumferenceMm * 360;
const backDeg = backLengthMm / circumferenceMm * 360;
const bodyBackSpin = 20;
const bodyForward = bodyDeg + 20;
const backBackSpin = 20;
const backForward = backDeg + 20;

const state = {
  applicationMode: "apl",
  maxMoveRatio: 21,
  buildInputs: {
    plateStartPositionDeg: 0,
    centerLineFrontDeg: 0,
    bodyApplicationReference: "leading-edge",
    backApplicationReference: "leading-edge",
    bodyOffsetMm: 0,
    backOffsetMm: 0
  },
  motionPlan: null
};

const map = {
  stationSections: { "3": "body", "4": "body", "5": "back", "6": "back" },
  objects: [
    { kind: "pad", station: 3, side: "outer", start: 149, end: 169 },
    { kind: "pad", station: 4, side: "outer", start: 189, end: 209 },
    { kind: "pad", station: 5, side: "outer", start: 230, end: 250 },
    { kind: "pad", station: 6, side: "outer", start: 270, end: 290 }
  ]
};

function makeRows() {
  const front = Number(state.buildInputs.centerLineFrontDeg);
  const bodyTarget = front - bodyDeg / 2;
  const backTarget = front + 180 - backDeg / 2;
  const bodySplit = 149 + 20 * bodyBackSpin / (bodyBackSpin + bodyForward);
  const bodySplit2 = 189 + 20 * bodyBackSpin / (bodyBackSpin + bodyForward);
  const backSplit = 230 + 20 * backBackSpin / (backBackSpin + backForward);
  const backSplit2 = 270 + 20 * backBackSpin / (backBackSpin + backForward);
  const rows = [
    { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { cmd: 7, tableAngle: 0.5, plateAngle: 0, action: "Orient Body to Tack Reference - Agg 3", station: 3, section: "body" },
    { cmd: 3, tableAngle: 147.5, plateAngle: bodyTarget, action: "Hold for Body Application - Agg 3", station: 3, section: "body", applicationReference: true },
    { cmd: 7, tableAngle: 149, plateAngle: bodyTarget, action: "Wipe Turn 1 Body - Agg 3", station: 3, section: "body", plannedRotation: -bodyBackSpin },
    { cmd: 7, tableAngle: bodySplit, plateAngle: bodyTarget - bodyBackSpin, action: "Wipe Turn 2 Body - Agg 3", station: 3, section: "body", plannedRotation: bodyForward },
    { cmd: 3, tableAngle: 169, plateAngle: bodyTarget - bodyBackSpin + bodyForward, action: "Wipe Hold Body - Agg 3", station: 3, section: "body" },
    { cmd: 7, tableAngle: 169.5, plateAngle: bodyTarget - bodyBackSpin + bodyForward, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body" },
    { cmd: 3, tableAngle: 187.5, plateAngle: bodyTarget, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body", wipeResetReference: true },
    { cmd: 7, tableAngle: 189, plateAngle: bodyTarget, action: "Wipe Turn 1 Body - Agg 4", station: 4, section: "body", plannedRotation: -bodyBackSpin },
    { cmd: 7, tableAngle: bodySplit2, plateAngle: bodyTarget - bodyBackSpin, action: "Wipe Turn 2 Body - Agg 4", station: 4, section: "body", plannedRotation: bodyForward },
    { cmd: 3, tableAngle: 209, plateAngle: bodyTarget - bodyBackSpin + bodyForward, action: "Wipe Hold Body - Agg 4", station: 4, section: "body" },
    { cmd: 7, tableAngle: 209.5, plateAngle: bodyTarget - bodyBackSpin + bodyForward, action: "Orient Back to Tack Reference - Agg 5", station: 5, section: "back" },
    { cmd: 3, tableAngle: 228.5, plateAngle: backTarget, action: "Hold for Back Application - Agg 5", station: 5, section: "back", applicationReference: true },
    { cmd: 7, tableAngle: 230, plateAngle: backTarget, action: "Wipe Turn 1 Back - Agg 5", station: 5, section: "back", plannedRotation: -backBackSpin },
    { cmd: 7, tableAngle: backSplit, plateAngle: backTarget - backBackSpin, action: "Wipe Turn 2 Back - Agg 5", station: 5, section: "back", plannedRotation: backForward },
    { cmd: 3, tableAngle: 250, plateAngle: backTarget - backBackSpin + backForward, action: "Wipe Hold Back - Agg 5", station: 5, section: "back" },
    { cmd: 7, tableAngle: 250.5, plateAngle: backTarget - backBackSpin + backForward, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back" },
    { cmd: 3, tableAngle: 268.5, plateAngle: backTarget, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back", wipeResetReference: true },
    { cmd: 7, tableAngle: 270, plateAngle: backTarget, action: "Wipe Turn 1 Back - Agg 6", station: 6, section: "back", plannedRotation: -backBackSpin },
    { cmd: 7, tableAngle: backSplit2, plateAngle: backTarget - backBackSpin, action: "Wipe Turn 2 Back - Agg 6", station: 6, section: "back", plannedRotation: backForward },
    { cmd: 3, tableAngle: 290, plateAngle: backTarget - backBackSpin + backForward, action: "End Curve - Rest", station: 6, section: "back", terminalRest: true }
  ];
  state.motionPlan = {
    rows,
    stationPlans: [
      { station: 3, section: "body" },
      { station: 4, section: "body" },
      { station: 5, section: "back" },
      { station: 6, section: "back" }
    ]
  };
  return rows;
}

const context = {
  console,
  state,
  setTimeout() {},
  finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
  selectedLabelApplicationState() { return { neck: false, body: true, back: true }; },
  inferAplStationSections(machineMap) { return { ...machineMap.stationSections }; },
  labelSectionForStation(station) { return station <= 4 ? "body" : "back"; },
  sectionLabel(section) { return section[0].toUpperCase() + section.slice(1); },
  generatedAplMapDrivenProfile() { return makeRows(); },
  LabelerAplMapProfileGenerator: { generate() { return makeRows(); } },
  LabelerLabelCenterlinePolicy: {
    applicationReference(section) { return state.buildInputs[`${section}ApplicationReference`] || "center-tack"; },
    sectionOffsetDeg() { return 0; },
    labelWidthDeg(section) { return section === "body" ? bodyDeg : backDeg; },
    finishedCenterlineFromApplication(section, angle, row) {
      const mode = row?.applicationReferenceMode || state.buildInputs[`${section}ApplicationReference`];
      return mode === "leading-edge" ? Number(angle) + (section === "body" ? bodyDeg : backDeg) / 2 : Number(angle);
    },
    applicationTargetFromCenterline(section, center, mode) {
      return mode === "leading-edge" ? Number(center) - (section === "body" ? bodyDeg : backDeg) / 2 : Number(center);
    }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "apl-first-tack-datum-flow-integration.js" });

const rows = context.generatedAplMapDrivenProfile(map);
const expectedFront = bodyDeg / 2;
const expectedBackTarget = expectedFront + 180 - backDeg / 2;

assert.ok(state.motionPlan.firstTackDatumFlowV41);
assert.ok(state.motionPlan.canonicalStationResetV43);
assert.equal(state.motionPlan.firstApplicationTackAnchoredToServoStart, true);
assert.ok(Math.abs(state.motionPlan.establishedFrontCenterlineDeg - expectedFront) < 0.11);
assert.ok(Math.abs(state.motionPlan.bodyApplicationTarget - 0) < 0.11);
assert.ok(Math.abs(state.motionPlan.backApplicationTarget - expectedBackTarget) < 0.11);
assert.ok(Math.abs(state.buildInputs.centerLineFrontDeg - expectedFront) < 1e-9);

const bodyApplication = rows.find((row) => row.station === 3 && row.applicationReference);
assert.ok(bodyApplication);
assert.equal(bodyApplication.plateAngle, 0, "The first active Body label must tack at the servo-start 0° datum.");
assert.equal(rows.some((row) => row.station === 3 && Number(row.cmd) === 7 && row.tableAngle < bodyApplication.tableAngle), false,
  "There must be no pre-turn from 0° to the first Body aggregate.");

const bodyReset = rows.find((row) => row.station === 4 && row.wipeResetReference);
assert.ok(bodyReset, "Body Aggregate 4 must restore the Body application reference before the second wipe.");
assert.ok(Math.abs(bodyReset.plateAngle) < 0.11);
const bodyResetIndex = rows.indexOf(bodyReset);
assert.equal(Number(rows[bodyResetIndex - 1].cmd), 7);
assert.equal(Number(bodyReset.cmd), 3);

const backApplication = rows.find((row) => row.station === 5 && row.applicationReference);
assert.ok(backApplication);
assert.ok(Math.abs(backApplication.plateAngle - expectedBackTarget) < 0.11);
const backReset = rows.find((row) => row.station === 6 && row.wipeResetReference);
assert.ok(backReset, "Back Aggregate 6 must restore the Back application reference before the second wipe.");
assert.ok(Math.abs(backReset.plateAngle - expectedBackTarget) < 0.11);
const backResetIndex = rows.indexOf(backReset);
assert.equal(Number(rows[backResetIndex - 1].cmd), 7);
assert.equal(Number(backReset.cmd), 3);

function wipe(station, turn) {
  return rows.find((row) => row.station === station && new RegExp(`Wipe Turn ${turn}`).test(row.action));
}

for (const [station, firstExpected, secondExpected] of [
  [3, -bodyBackSpin, bodyForward],
  [4, -bodyBackSpin, bodyForward],
  [5, -backBackSpin, backForward],
  [6, -backBackSpin, backForward]
]) {
  assert.ok(wipe(station, 1) && wipe(station, 2));
  assert.ok(Math.abs(wipe(station, 1).plannedRotation - firstExpected) < 0.11);
  assert.ok(Math.abs(wipe(station, 2).plannedRotation - secondExpected) < 0.11);
}
assert.ok(Math.abs(wipe(4, 1).plannedRotation - wipe(3, 1).plannedRotation) < 0.11);
assert.ok(Math.abs(wipe(4, 2).plannedRotation - wipe(3, 2).plannedRotation) < 0.11);
assert.ok(Math.abs(wipe(6, 1).plannedRotation - wipe(5, 1).plannedRotation) < 0.11);
assert.ok(Math.abs(wipe(6, 2).plannedRotation - wipe(5, 2).plannedRotation) < 0.11);

let run = 0;
let maxRun = 0;
for (const row of rows) {
  run = Number(row.cmd) === 7 ? run + 1 : 0;
  maxRun = Math.max(maxRun, run);
}
assert.ok(maxRun <= 2, `Canonical station sequence must never exceed two consecutive CMD 7 rows; got ${maxRun}.`);

console.log("APL first-tack datum and canonical Body/Back station-reset regression passed.");
