"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const policySource = fs.readFileSync(path.join(root, "app", "label-centerline-policy-integration.js"), "utf8");
const completionSource = fs.readFileSync(path.join(root, "app", "apl-finished-centerline-completion-integration.js"), "utf8");
const startupSource = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(completionSource));
assert.match(startupSource, /apl-finished-centerline-completion-integration\.js/);
assert.match(startupSource, /finished-centerline-completion-v39-20260808-2118/);

const effectiveDiameterMm = 60.68 - 2 * 0.3;
const circumferenceMm = effectiveDiameterMm * Math.PI;
const bodyLengthMm = 64.897;
const backLengthMm = 47.498;
const bodyDeg = bodyLengthMm / circumferenceMm * 360;
const backDeg = backLengthMm / circumferenceMm * 360;
const tenDegreesMm = circumferenceMm * 10 / 360;

const state = {
  applicationMode: "apl",
  selectedBrand: "12oz LandShark (LN)",
  selectedBottle: "SSNR - 12 Oz",
  maxMoveRatio: 21,
  buildInputs: {
    centerLineFrontDeg: 0,
    plateStartPositionDeg: 0,
    neckApplication: "Center",
    bodyApplicationReference: "leading-edge",
    backApplicationReference: "leading-edge",
    bodyOffsetMm: 0,
    backOffsetMm: 0,
    bodyContactMm: tenDegreesMm,
    backContactMm: tenDegreesMm,
    bodyOverWipeDeg: 0,
    backOverWipeDeg: 0
  },
  motionPlan: null
};

const label = {
  applicationMode: "apl",
  brand: "12oz LandShark (LN)",
  bodyLengthMm,
  backLengthMm,
  neckLengthMm: 0,
  neckBottomCurveMm: 0,
  neckBottomCircumferenceMm: 0,
  enabledLabelSections: { neck: false, body: true, back: true }
};
const bottle = {
  bottleType: "SSNR - 12 Oz",
  diameterTargetMm: 60.68,
  radiusReductionMm: 0.3
};

const machineMap = {
  stationSections: { "3": "body", "5": "back" },
  aggregateAngles: { "3": 155, "5": 245 },
  objects: [
    { kind: "pad", station: 3, side: "outer", start: 150, end: 165 },
    { kind: "pad", station: 5, side: "outer", start: 245, end: 260 }
  ]
};

function collapsedLegacyRows() {
  const backApplication = 180 - backDeg / 2;
  return [
    { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { cmd: 3, tableAngle: 147.5, plateAngle: 0, action: "Hold for Body Application - Agg 3", station: 3, section: "body" },
    { cmd: 7, tableAngle: 150, plateAngle: 0, action: "Wipe Turn 1 Body - Agg 3", station: 3, section: "body", plannedRotation: -10 },
    { cmd: 7, tableAngle: 155, plateAngle: -10, action: "Wipe Turn 2 Body - Agg 3", station: 3, section: "body", plannedRotation: backApplication + 10 },
    // This reproduces the old bug: Body wipe completion was collapsed directly
    // onto the next Back application target instead of completing the wipe.
    { cmd: 3, tableAngle: 165, plateAngle: backApplication, action: "Hold for Back Application - Agg 5", station: 3, section: "body" },
    { cmd: 7, tableAngle: 245, plateAngle: backApplication, action: "Wipe Turn 1 Back - Agg 5", station: 5, section: "back", plannedRotation: -10 },
    { cmd: 7, tableAngle: 250, plateAngle: backApplication - 10, action: "Wipe Turn 2 Back - Agg 5", station: 5, section: "back", plannedRotation: backDeg },
    { cmd: 3, tableAngle: 260, plateAngle: backApplication - 10 + backDeg, action: "End Curve - Rest", station: 5, section: "back", terminalRest: true }
  ];
}

function seedRows() {
  const rows = Array.from({ length: 32 }, (_, index) => ({ cmd: 3, tableAngle: index * 10, plateAngle: 0, action: `Row ${index + 1}` }));
  rows[11] = { ...rows[11], action: "Hold for Body Application - Agg 3", station: 3, section: "body", plateAngle: -bodyDeg / 2 };
  rows[21] = { ...rows[21], action: "Hold for Back Application - Agg 5", station: 5, section: "back", plateAngle: 180 - backDeg / 2 };
  return rows;
}

const context = {
  console,
  state,
  setTimeout() {},
  finishAngle(value) { return Math.round(Number(value) * 10) / 10; },
  profileTiming: { spenderArriveEarly: 7.5, codingArriveEarlyDeg: 75 },
  selectedLabelApplicationState() { return { neck: false, body: true, back: true }; },
  selectedLabelSpec() { return label; },
  selectedBottleSpec() { return bottle; },
  bodyCircumference() { return circumferenceMm; },
  sectionLabel(section) { return section.charAt(0).toUpperCase() + section.slice(1); },
  inferAplStationSections(map) { return { ...map.stationSections }; },
  labelSectionForStation(station) { return Number(station) <= 4 ? "body" : "back"; },
  buildProgramSummary() { return { rows: [["Center Line Front (deg)", 0], ["Center Line Back (deg)", 180]] }; },
  sectionWipePlan() { return null; },
  generatedAplSeedProfile() { return seedRows(); },
  LabelerAplSeedProfileGenerator: { generateSeed() { return seedRows(); } },
  generatedAplMapDrivenProfile() {
    const rows = collapsedLegacyRows();
    state.motionPlan = {
      rows,
      issues: [],
      stationPlans: [
        { station: 3, section: "body", movePath: [-10, 145] },
        { station: 5, section: "back", movePath: [-10, backDeg] }
      ]
    };
    return rows;
  },
  LabelerAplMapProfileGenerator: { generate() { return collapsedLegacyRows(); } },
  LabelerGeometryDriver: {
    solveSection({ mode, labelLengthMm, circumferenceMm: circumference, contactMm, overWipeDeg }) {
      const labelWidth = Number(labelLengthMm) / Number(circumference) * 360;
      const over = Number(overWipeDeg || 0);
      if (mode === "center-tack-two-stage") {
        const stageRequired = labelWidth / 2 + over;
        return {
          mode,
          labelDeg: labelWidth,
          stageRequired,
          totalRequired: stageRequired * 2,
          stages: [{ requiredRotation: stageRequired }, { requiredRotation: stageRequired }]
        };
      }
      const contactDeg = Number(contactMm || 0) / Number(circumference) * 360;
      const backSpinRequired = contactDeg + over;
      const forwardWipeRequired = labelWidth + over * 2;
      return {
        mode,
        labelDeg: labelWidth,
        backSpinRequired,
        forwardWipeRequired,
        totalRequired: backSpinRequired + forwardWipeRequired,
        stages: [{ requiredRotation: backSpinRequired }, { requiredRotation: forwardWipeRequired }]
      };
    }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(policySource, context, { filename: "label-centerline-policy-integration.js" });
vm.runInContext(completionSource, context, { filename: "apl-finished-centerline-completion-integration.js" });

const api = context.LabelerAplFinishedCenterlineCompletion;
assert.equal(api.installed, true);
assert.equal(api.finishedCenterline("body"), 0);
assert.equal(api.finishedCenterline("back"), 180);
assert.ok(Math.abs(api.applicationTarget("body") + bodyDeg / 2) < 1e-9);
assert.ok(Math.abs(api.applicationTarget("back") - (180 - backDeg / 2)) < 1e-9);
assert.equal(api.solveAplWipe("body").mode, "leading-edge");
assert.equal(api.solveAplWipe("back").mode, "leading-edge");

const rows = context.generatedAplMapDrivenProfile(machineMap);
const bodyApplication = rows.find((row) => row.station === 3 && row.section === "body" && row.applicationReference);
const backApplication = rows.find((row) => row.station === 5 && row.section === "back" && row.applicationReference);
assert.ok(bodyApplication);
assert.ok(backApplication, "The previously collapsed Back application must become an explicit reference again.");
assert.ok(Math.abs(bodyApplication.plateAngle + bodyDeg / 2) < 0.06);
assert.ok(Math.abs(backApplication.plateAngle - (180 - backDeg / 2)) < 0.06);
assert.notEqual(bodyApplication.plateAngle, 0, "Leading Edge Body application must not be rebased to servo zero.");

const bodyTurn1 = rows.find((row) => /Wipe Turn 1 Body/.test(row.action));
const bodyTurn2 = rows.find((row) => /Wipe Turn 2 Body/.test(row.action));
const bodyHold = rows.find((row) => /Wipe Hold Body/.test(row.action));
assert.ok(Math.abs(bodyTurn1.plannedRotation + 10) < 0.06);
assert.ok(Math.abs(bodyTurn2.plannedRotation - bodyDeg) < 0.06, "Body Turn 2 must complete the full developed label wipe.");
assert.ok(Math.abs(bodyHold.plateAngle - (-bodyDeg / 2 - 10 + bodyDeg)) < 0.06);
assert.ok(rows.some((row) => /Hold Finished Body Centerline/.test(row.action) && Math.abs(row.plateAngle) < 0.06), "Body must recover the finished 0-degree front datum after the full wipe.");

const backTurn1 = rows.find((row) => /Wipe Turn 1 Back/.test(row.action));
const backTurn2 = rows.find((row) => /Wipe Turn 2 Back/.test(row.action));
const backHold = rows.find((row) => /Wipe Hold Back/.test(row.action));
assert.ok(Math.abs(backTurn1.plannedRotation + 10) < 0.06, "Back uses the same physical outside-pad set-down direction as Body; it is not sign-flipped just because it is a Back label.");
assert.ok(Math.abs(backTurn2.plannedRotation - backDeg) < 0.06, "Back Turn 2 must complete the full developed label wipe.");
assert.ok(Math.abs(backHold.plateAngle - ((180 - backDeg / 2) - 10 + backDeg)) < 0.06);
const terminal = rows.find((row) => row.terminalRest || /End Curve\s*-\s*Rest/.test(row.action));
assert.ok(terminal);
assert.ok(Math.abs(terminal.plateAngle - 180) < 0.06, "The final Back wipe must recover the finished 180-degree datum before terminal Rest.");

assert.equal(state.motionPlan.applicationDatumOffset, 0);
assert.equal(state.motionPlan.firstApplicationZeroRebaseRetired, true);
assert.equal(state.motionPlan.finishedCenterlineCompletionV39, true);
assert.ok(Math.abs(state.motionPlan.bodyApplicationTarget + bodyDeg / 2) < 0.06);
assert.ok(Math.abs(state.motionPlan.backApplicationTarget - (180 - backDeg / 2)) < 0.06);

// Application reference is section-specific. Changing Body to Center Tack must
// not change Back's Leading Edge rule.
state.buildInputs.bodyApplicationReference = "center-tack";
assert.equal(api.applicationTarget("body"), 0);
assert.equal(api.solveAplWipe("body").mode, "center-tack-two-stage");
assert.ok(Math.abs(api.applicationTarget("back") - (180 - backDeg / 2)) < 1e-9);
assert.equal(api.solveAplWipe("back").mode, "leading-edge");

console.log("APL finished-centerline completion regression passed.");
