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
      brand: "12oz Land Shark (LN)",
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

const bodyApplication = rows.find((row) => row.station === 3 && row.applicationReference);
assert.ok(bodyApplication, "Body Aggregate 3 must be the first active physical application.");
assert.equal(bodyApplication.plateAngle, 0, "LandShark Body leading edge must tack at servo 0°.");
assert.equal(rows.some((row) => row.station === 3 && Number(row.cmd) === 7 && row.tableAngle < bodyApplication.tableAngle), false,
  "No correction may turn the bottle away from 0° before the first Body application.");
assert.equal(rows.some((row) => row.station === 4 && /Application|Orient Body for Re-Wipe/i.test(String(row.action))), false,
  "Aggregate 4 must continue Body re-wipe instead of creating another Body application/reset.");
assert.equal(rows.some((row) => row.station === 6 && /Application|Orient Back for Re-Wipe/i.test(String(row.action))), false,
  "Aggregate 6 must continue Back re-wipe instead of creating another Back application/reset.");

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

const bodyWipes = rows.filter((row) => row.section === "body" && /Wipe Turn/.test(String(row.action)));
const backWipes = rows.filter((row) => row.section === "back" && /Wipe Turn/.test(String(row.action)));
assert.equal(bodyWipes.length, 4, "Body must have two wipe turns on Aggregate 3 and two re-wipe turns on Aggregate 4.");
assert.equal(backWipes.length, 4, "Back must have two wipe turns on Aggregate 5 and two re-wipe turns on Aggregate 6.");

console.log(`LandShark common generator runtime passed with ${rows.length} rows and max CMD7 run ${maxCorrectionRun}.`);
