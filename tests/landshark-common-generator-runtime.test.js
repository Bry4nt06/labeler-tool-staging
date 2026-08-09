"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const circumferenceMm = (60.68 - 0.6) * Math.PI;
const bodyLengthMm = 64.897;
const backLengthMm = 47.498;
const bodyDeg = bodyLengthMm / circumferenceMm * 360;
const backDeg = backLengthMm / circumferenceMm * 360;
const tenDegMm = circumferenceMm * 10 / 360;
const bodyBackSpin = 20;
const bodyForward = bodyDeg + 20;
const backBackSpin = 20;
const backForward = backDeg + 20;
const expectedBackTarget = bodyDeg / 2 + 180 - backDeg / 2;

const state = {
  applicationMode: "apl",
  maxMoveRatio: 21,
  buildInputs: {
    plateStartPositionDeg: 0,
    centerLineFrontDeg: 0,
    bodyApplicationReference: "leading-edge",
    backApplicationReference: "leading-edge",
    bodyOffsetMm: 0,
    backOffsetMm: 0,
    bodyContactMm: tenDegMm,
    backContactMm: tenDegMm,
    bodyOverWipeDeg: 10,
    backOverWipeDeg: 10,
    backInspectionOffsetMm: 0
  },
  motionPlan: null
};

const map = {
  applicationMode: "apl",
  machineType: "TopModul",
  machineSettings: { zeroAngle: 0 },
  aggregateAngles: { "1": 68.5, "2": 108.5, "3": 148.5, "4": 188.5, "5": 229.5, "6": 269.5 },
  stationSections: { "1": "neck", "2": "neck", "3": "body", "4": "body", "5": "back", "6": "back" },
  objects: [
    { id: "body-3", kind: "pad", station: 3, side: "outer", start: 149, end: 169, enabled: true },
    { id: "body-4", kind: "pad", station: 4, side: "outer", start: 189, end: 209, enabled: true },
    { id: "back-5", kind: "pad", station: 5, side: "outer", start: 230, end: 250, enabled: true },
    { id: "back-6", kind: "pad", station: 6, side: "outer", start: 270, end: 290, enabled: true }
  ]
};

function geometrySolve({ mode, labelLengthMm, circumferenceMm: circumference, contactMm, overWipeDeg }) {
  const labelDeg = Number(labelLengthMm) / Number(circumference) * 360;
  const contactDeg = Number(contactMm || 0) / Number(circumference) * 360;
  const over = Number(overWipeDeg || 0);
  if (mode === "center-tack-two-stage") {
    const stageRequired = labelDeg / 2 + over;
    return {
      mode,
      labelDeg,
      stageRequired,
      totalRequired: stageRequired * 2,
      stages: [{ requiredRotation: stageRequired }, { requiredRotation: stageRequired }]
    };
  }
  return {
    mode,
    labelDeg,
    backSpinRequired: contactDeg + over,
    forwardWipeRequired: labelDeg + 2 * over,
    totalRequired: contactDeg + over + labelDeg + 2 * over,
    stages: [
      { requiredRotation: contactDeg + over },
      { requiredRotation: labelDeg + 2 * over }
    ]
  };
}

const context = {
  console,
  state,
  setTimeout() {},
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm(value) {
    const result = Number(value) % 360;
    return result < 0 ? result + 360 : result;
  },
  finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
  normalizeBuilderObject(item) { return { ...item }; },
  isStationEnabled() { return true; },
  inferAplStationSections(machineMap) { return { ...machineMap.stationSections }; },
  labelSectionForStation(station) { return Number(station) <= 2 ? "neck" : Number(station) <= 4 ? "body" : "back"; },
  sectionLabel(section) { return section[0].toUpperCase() + section.slice(1); },
  selectedLabelApplicationState() { return { neck: false, body: true, back: true }; },
  selectedLabelSpec() {
    return {
      brand: "12oz LandShark (LN)",
      bodyLengthMm,
      backLengthMm,
      neckBottomCurveMm: 0,
      neckLengthMm: 0,
      neckBottomCircumferenceMm: 104,
      codeBoxCenterMm: 12
    };
  },
  selectedBottleSpec() { return { bottleType: "SSNR - 12 Oz" }; },
  bodyCircumference() { return circumferenceMm; },
  degFromMm(mm, circumference) { return Number(mm || 0) / Number(circumference) * 360; },
  profileTiming: {
    spenderArriveEarly: 1,
    codingArriveEarlyDeg: 75
  },
  generatedAplSeedProfile() {
    const rows = Array.from({ length: 22 }, () => ({ plateAngle: 0 }));
    rows[1] = { plateAngle: 0 };
    rows[11] = { plateAngle: -bodyDeg / 2 };
    rows[21] = { plateAngle: 180 - backDeg / 2 };
    return rows;
  },
  sectionWipePlan(section) {
    return geometrySolve({
      mode: "leading-edge",
      labelLengthMm: section === "body" ? bodyLengthMm : backLengthMm,
      circumferenceMm,
      contactMm: section === "body" ? state.buildInputs.bodyContactMm : state.buildInputs.backContactMm,
      overWipeDeg: section === "body" ? state.buildInputs.bodyOverWipeDeg : state.buildInputs.backOverWipeDeg
    });
  },
  LabelerGeometryDriver: { solveSection: geometrySolve },
  LabelerServoCommandDriver: {
    finalize(rows) { return rows.map((row) => ({ ...row })); }
  },
  LabelerLabelCenterlinePolicy: {
    applicationReference(section) { return state.buildInputs[`${section}ApplicationReference`] || "center-tack"; },
    sectionOffsetDeg() { return 0; },
    labelWidthDeg(section) { return section === "body" ? bodyDeg : section === "back" ? backDeg : 0; },
    applicationTargetFromCenterline(section, center, mode) {
      if (mode !== "leading-edge") return Number(center);
      return Number(center) - (section === "body" ? bodyDeg : backDeg) / 2;
    },
    finishedCenterlineFromApplication(section, angle, row) {
      const mode = row?.applicationReferenceMode || state.buildInputs[`${section}ApplicationReference`];
      if (mode !== "leading-edge") return Number(angle);
      return Number(angle) + (section === "body" ? bodyDeg : backDeg) / 2;
    }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

[
  "app/apl-map-profile-generation.js",
  "app/apl-body-back-two-label-transition-integration.js",
  "app/apl-back-wipe-direction-correction-integration.js",
  "app/apl-body-back-opposite-reference-integration.js",
  "app/apl-finished-centerline-completion-integration.js",
  "app/apl-first-tack-datum-flow-integration.js"
].forEach((relative) => {
  const text = source(relative);
  assert.doesNotThrow(() => new vm.Script(text, { filename: relative }));
  vm.runInContext(text, context, { filename: relative });
});

const rows = context.generatedAplMapDrivenProfile(map);
assert.ok(Array.isArray(rows) && rows.length > 0);
assert.equal(context.LabelerAplBodyBackTwoLabelTransition.retired, true);
assert.equal(context.LabelerAplBackWipeDirectionCorrection.retired, true);
assert.equal(context.LabelerAplBodyBackOppositeReference.retired, true);
assert.equal(state.motionPlan.firstTackDatumFlowV41, true);
assert.equal(state.motionPlan.canonicalStationResetV43, true);

function wipe(station, turn) {
  return rows.find((row) => Number(row.station) === station && new RegExp(`Wipe Turn ${turn}`).test(String(row.action)));
}
function stationReference(station, section) {
  const groupStart = rows.findIndex((row) => Number(row.station) === station && /Wipe Turn 1/.test(String(row.action)));
  return rows.slice(0, groupStart).reverse().find((row) => Number(row.station) === station
    && row.section === section
    && Number(row.cmd) === 3
    && (row.applicationReference || row.wipeResetReference || /Application|Re-Wipe/.test(String(row.action))));
}
function assertNear(actual, expected, message) {
  assert.ok(Math.abs(Number(actual) - Number(expected)) < 0.11,
    `${message}: expected ${Number(expected).toFixed(3)}, got ${Number(actual).toFixed(3)}`);
}

const bodyApplication = stationReference(3, "body");
assert.ok(bodyApplication, "Body Aggregate 3 must be the first active physical application.");
assert.equal(bodyApplication.applicationReference, true);
assertNear(bodyApplication.plateAngle, 0, "LandShark Body leading edge must tack at servo 0°");
assert.equal(rows.some((row) => row.station === 3 && Number(row.cmd) === 7 && row.tableAngle < bodyApplication.tableAngle), false,
  "No correction may turn the bottle away from 0° before the first Body application.");

const bodyReset = stationReference(4, "body");
assert.ok(bodyReset?.wipeResetReference, "Aggregate 4 must restore the Body application reference before re-wipe.");
assertNear(bodyReset.plateAngle, 0, "Aggregate 4 Body reset must return to the same Body application angle");
const bodyResetIndex = rows.indexOf(bodyReset);
assert.ok(bodyResetIndex > 0 && Number(rows[bodyResetIndex - 1].cmd) === 7,
  "Aggregate 4 Body reset must be reached by a CMD 7 correction.");
assert.equal(Number(bodyReset.cmd), 3, "Aggregate 4 Body reset must establish a CMD 3 reference before wiping.");

const backApplication = stationReference(5, "back");
assert.ok(backApplication?.applicationReference, "Aggregate 5 must establish the Back application reference.");
assertNear(backApplication.plateAngle, expectedBackTarget, "Aggregate 5 Back application target");
const backReset = stationReference(6, "back");
assert.ok(backReset?.wipeResetReference, "Aggregate 6 must restore the Back application reference before re-wipe.");
assertNear(backReset.plateAngle, expectedBackTarget, "Aggregate 6 Back reset must return to the same Back application angle");
const backResetIndex = rows.indexOf(backReset);
assert.ok(backResetIndex > 0 && Number(rows[backResetIndex - 1].cmd) === 7,
  "Aggregate 6 Back reset must be reached by a CMD 7 correction.");
assert.equal(Number(backReset.cmd), 3, "Aggregate 6 Back reset must establish a CMD 3 reference before wiping.");

const expectedTurns = [
  [3, "body", -bodyBackSpin, bodyForward],
  [4, "body", -bodyBackSpin, bodyForward],
  [5, "back", -backBackSpin, backForward],
  [6, "back", -backBackSpin, backForward]
];
for (const [station, section, firstExpected, secondExpected] of expectedTurns) {
  const first = wipe(station, 1);
  const second = wipe(station, 2);
  assert.ok(first && second, `Aggregate ${station} must contain both ${section} wipe turns.`);
  assertNear(first.plannedRotation, firstExpected, `Aggregate ${station} ${section} Wipe Turn 1`);
  assertNear(second.plannedRotation, secondExpected, `Aggregate ${station} ${section} Wipe Turn 2`);
}
assertNear(wipe(4, 1).plannedRotation, wipe(3, 1).plannedRotation,
  "Body Aggregate 4 Turn 1 must match Body Aggregate 3, not retrace it");
assertNear(wipe(4, 2).plannedRotation, wipe(3, 2).plannedRotation,
  "Body Aggregate 4 Turn 2 must match Body Aggregate 3, not retrace it");
assertNear(wipe(6, 1).plannedRotation, wipe(5, 1).plannedRotation,
  "Back Aggregate 6 Turn 1 must match Back Aggregate 5, not retrace it");
assertNear(wipe(6, 2).plannedRotation, wipe(5, 2).plannedRotation,
  "Back Aggregate 6 Turn 2 must match Back Aggregate 5, not retrace it");

let correctionRun = 0;
let maxCorrectionRun = 0;
for (let index = 0; index < rows.length; index += 1) {
  const row = rows[index];
  correctionRun = Number(row.cmd) === 7 ? correctionRun + 1 : 0;
  maxCorrectionRun = Math.max(maxCorrectionRun, correctionRun);
  if (Number(row.cmd) !== 7 || index + 1 >= rows.length) continue;
  const next = rows[index + 1];
  const span = Number(next.tableAngle) - Number(row.tableAngle);
  const rotation = Number(next.plateAngle) - Number(row.plateAngle);
  const ratio = Math.abs(rotation) / Math.max(0.001, span);
  assert.ok(ratio <= state.maxMoveRatio + 1e-9,
    `HMI ${index + 1} must stay within ${state.maxMoveRatio}:1, got ${ratio.toFixed(2)}:1 (${rotation.toFixed(1)}°/${span.toFixed(1)}°).`);
}
assert.ok(maxCorrectionRun <= 2, `Common Body+Back APL path produced ${maxCorrectionRun} consecutive CMD 7 commands.`);

console.log(`LandShark canonical Body+Back runtime passed with ${rows.length} rows, matching aggregate turns, and max CMD7 run ${maxCorrectionRun}.`);
