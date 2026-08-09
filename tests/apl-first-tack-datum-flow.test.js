"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "apl-first-tack-datum-flow-integration.js"), "utf8");
assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /first physical tack establishes the finished-label coordinate/);
assert.match(source, /No pre-application turn is permitted/);
assert.match(source, /Retrace the previous wipe path/);

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
  const bodyTackLegacy = -bodyDeg / 2;
  const backTackLegacy = 180 - backDeg / 2;
  const bodySplit = 149 + 20 * bodyBackSpin / (bodyBackSpin + bodyForward);
  const backSplit = 230 + 20 * backBackSpin / (backBackSpin + backForward);
  const rows = [
    { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { cmd: 7, tableAngle: 0.5, plateAngle: 0, action: "Orient Body to Tack Reference - Agg 3", station: 3, section: "body" },
    { cmd: 3, tableAngle: 141, plateAngle: bodyTackLegacy, action: "Hold for Body Application - Agg 3", station: 3, section: "body", applicationReference: true },
    { cmd: 7, tableAngle: 149, plateAngle: bodyTackLegacy, action: "Wipe Turn 1 Body - Agg 3", station: 3, section: "body", plannedRotation: -bodyBackSpin },
    { cmd: 7, tableAngle: bodySplit, plateAngle: bodyTackLegacy - bodyBackSpin, action: "Wipe Turn 2 Body - Agg 3", station: 3, section: "body", plannedRotation: bodyForward },
    { cmd: 3, tableAngle: 169, plateAngle: bodyTackLegacy - bodyBackSpin + bodyForward, action: "Wipe Hold Body - Agg 3", station: 3, section: "body" },
    { cmd: 7, tableAngle: 169.5, plateAngle: bodyTackLegacy - bodyBackSpin + bodyForward, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body" },
    { cmd: 3, tableAngle: 181, plateAngle: bodyTackLegacy, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body", wipeResetReference: true },
    { cmd: 7, tableAngle: 189, plateAngle: bodyTackLegacy, action: "Wipe Turn 1 Body - Agg 4", station: 4, section: "body", plannedRotation: -bodyBackSpin },
    { cmd: 7, tableAngle: 191.5, plateAngle: bodyTackLegacy - bodyBackSpin, action: "Wipe Turn 2 Body - Agg 4", station: 4, section: "body", plannedRotation: bodyForward },
    { cmd: 3, tableAngle: 209, plateAngle: bodyTackLegacy - bodyBackSpin + bodyForward, action: "Wipe Hold Body - Agg 4", station: 4, section: "body" },
    { cmd: 7, tableAngle: 209.5, plateAngle: bodyTackLegacy - bodyBackSpin + bodyForward, action: "Orient Back to Tack Reference - Agg 5", station: 5, section: "back" },
    { cmd: 3, tableAngle: 222, plateAngle: backTackLegacy, action: "Hold for Back Application - Agg 5", station: 5, section: "back", applicationReference: true },
    { cmd: 7, tableAngle: 230, plateAngle: backTackLegacy, action: "Wipe Turn 1 Back - Agg 5", station: 5, section: "back", plannedRotation: -backBackSpin },
    { cmd: 7, tableAngle: backSplit, plateAngle: backTackLegacy - backBackSpin, action: "Wipe Turn 2 Back - Agg 5", station: 5, section: "back", plannedRotation: backForward },
    { cmd: 3, tableAngle: 250, plateAngle: backTackLegacy - backBackSpin + backForward, action: "Wipe Hold Back - Agg 5", station: 5, section: "back" },
    { cmd: 7, tableAngle: 250.5, plateAngle: backTackLegacy - backBackSpin + backForward, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back" },
    { cmd: 3, tableAngle: 262, plateAngle: backTackLegacy, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back", wipeResetReference: true },
    { cmd: 7, tableAngle: 270, plateAngle: backTackLegacy, action: "Wipe Turn 1 Back - Agg 6", station: 6, section: "back", plannedRotation: -backBackSpin },
    { cmd: 7, tableAngle: 272.5, plateAngle: backTackLegacy - backBackSpin, action: "Wipe Turn 2 Back - Agg 6", station: 6, section: "back", plannedRotation: backForward },
    { cmd: 3, tableAngle: 290, plateAngle: backTackLegacy - backBackSpin + backForward, action: "End Curve - Rest", station: 6, section: "back", terminalRest: true }
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
const bodyCenter = bodyDeg / 2;
const expectedBackCenter = bodyCenter + 180;
const expectedBackTack = expectedBackCenter - backDeg / 2;

assert.ok(state.motionPlan.firstTackDatumFlowV41);
assert.equal(state.motionPlan.firstApplicationTackAnchoredToServoStart, true);
assert.ok(Math.abs(state.motionPlan.establishedFrontCenterlineDeg - bodyCenter) < 0.11);
assert.ok(Math.abs(state.motionPlan.bodyApplicationTarget - 0) < 0.11);
assert.ok(Math.abs(state.motionPlan.backApplicationTarget - expectedBackTack) < 0.11);
assert.ok(Math.abs(state.buildInputs.centerLineFrontDeg - bodyCenter) < 1e-9);

const bodyApplication = rows.find((row) => row.station === 3 && row.applicationReference);
assert.ok(bodyApplication);
assert.equal(bodyApplication.plateAngle, 0, "The first active Body label must tack at the servo-start 0° datum.");
assert.equal(rows.some((row) => row.station === 3 && Number(row.cmd) === 7 && row.tableAngle < bodyApplication.tableAngle), false, "There must be no pre-turn from 0° to the first Body aggregate.");
assert.equal(rows.some((row) => row.station === 4 && (row.wipeResetReference || /Orient Body for Re-Wipe/.test(row.action))), false, "Body Aggregate 4 must not reset in free air.");
assert.equal(rows.some((row) => row.station === 6 && (row.wipeResetReference || /Orient Back for Re-Wipe/.test(row.action))), false, "Back Aggregate 6 must not reset in free air.");

const body3w1 = rows.find((row) => row.station === 3 && /Wipe Turn 1 Body/.test(row.action));
const body3w2 = rows.find((row) => row.station === 3 && /Wipe Turn 2 Body/.test(row.action));
const body4w1 = rows.find((row) => row.station === 4 && /Wipe Turn 1 Body/.test(row.action));
const body4w2 = rows.find((row) => row.station === 4 && /Wipe Turn 2 Body/.test(row.action));
assert.ok(body3w1 && body3w2 && body4w1 && body4w2);
assert.ok(Math.abs(body4w1.plannedRotation + body3w2.plannedRotation) < 0.11, "Re-wipe Turn 1 must retrace the prior forward wipe.");
assert.ok(Math.abs(body4w2.plannedRotation + body3w1.plannedRotation) < 0.11, "Re-wipe Turn 2 must retrace the prior set-down.");

for (let index = 0; index < rows.length - 1; index += 1) {
  const row = rows[index];
  if (Number(row.cmd) !== 7) continue;
  const next = rows[index + 1];
  const span = Number(next.tableAngle) - Number(row.tableAngle);
  const rotation = Number(next.plateAngle) - Number(row.plateAngle);
  const ratio = Math.abs(rotation) / Math.max(0.001, span);
  assert.ok(ratio <= 21 + 1e-9, `HMI ${index + 1} ratio ${ratio.toFixed(2)} must stay within the 21:1 limit.`);
  assert.ok(!(Math.abs(rotation) >= 19.5 && span <= 0.5001), `HMI ${index + 1} must not compress a ~20° wipe into 0.5° table travel.`);
}

console.log("APL first-tack datum, continuous re-wipe, and proportional wipe-window regression passed.");
