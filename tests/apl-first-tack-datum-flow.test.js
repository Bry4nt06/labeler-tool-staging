"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "apl-first-tack-datum-flow-integration.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source));
assert.match(source, /canonical-section-handoff-v44/);
assert.match(source, /first physical label starts from the configured servo-start datum/i);
assert.match(source, /Correction -> Rest reference/);
assert.match(source, /repeats the same two wipe directions/);
assert.match(source, /Body -> Back change is always Correction -> Rest before Back wiping/);
assert.doesNotMatch(source, /Retrace the previous wipe path/);

const bodyDeg = 124;
const backDeg = 92;
const state = {
  applicationMode: "apl",
  buildInputs: {
    plateStartPositionDeg: 0,
    centerLineFrontDeg: 0,
    bodyApplicationReference: "leading-edge",
    backApplicationReference: "leading-edge"
  },
  motionPlan: null
};
const map = {
  stationSections: { "3": "body", "4": "body", "5": "back", "6": "back" },
  objects: [
    { kind: "pad", station: 3, start: 149, end: 169 },
    { kind: "pad", station: 4, start: 189, end: 209 },
    { kind: "pad", station: 5, start: 230, end: 250 },
    { kind: "pad", station: 6, start: 270, end: 290 }
  ]
};

function baseRows() {
  const bodyTarget = 0;
  const bodyEnd = 124;
  const backTarget = bodyDeg / 2 + 180 - backDeg / 2;
  const backEnd = backTarget + backDeg;
  const rows = [
    { cmd: 3, tableAngle: 0, plateAngle: 0, action: "Zero Line" },
    { cmd: 7, tableAngle: 0.5, plateAngle: 0, action: "Orient Body to Tack Reference - Agg 3", station: 3, section: "body" },
    { cmd: 3, tableAngle: 147.5, plateAngle: bodyTarget, action: "Hold for Body Application - Agg 3", station: 3, section: "body", applicationReference: true },
    { cmd: 7, tableAngle: 149, plateAngle: bodyTarget, action: "Wipe Turn 1 Body - Agg 3", station: 3, section: "body" },
    { cmd: 7, tableAngle: 151.8, plateAngle: -20, action: "Wipe Turn 2 Body - Agg 3", station: 3, section: "body" },
    { cmd: 3, tableAngle: 169, plateAngle: bodyEnd, action: "Wipe Hold Body - Agg 3", station: 3, section: "body" },
    { cmd: 7, tableAngle: 169.5, plateAngle: bodyEnd, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body" },
    { cmd: 3, tableAngle: 187.5, plateAngle: bodyTarget, action: "Orient Body for Re-Wipe - Agg 4", station: 4, section: "body", wipeResetReference: true },
    { cmd: 7, tableAngle: 189, plateAngle: bodyTarget, action: "Wipe Turn 1 Body - Agg 4", station: 4, section: "body" },
    { cmd: 7, tableAngle: 191.8, plateAngle: -20, action: "Wipe Turn 2 Body - Agg 4", station: 4, section: "body" },
    { cmd: 3, tableAngle: 209, plateAngle: bodyEnd, action: "Wipe Hold Body - Agg 4", station: 4, section: "body" },
    // Intentionally omit the Back application pair. v44 must restore it.
    { cmd: 7, tableAngle: 230, plateAngle: backTarget, action: "Wipe Turn 1 Back - Agg 5", station: 5, section: "back" },
    { cmd: 7, tableAngle: 233, plateAngle: backTarget - 20, action: "Wipe Turn 2 Back - Agg 5", station: 5, section: "back" },
    { cmd: 3, tableAngle: 250, plateAngle: backEnd, action: "Wipe Hold Back - Agg 5", station: 5, section: "back" },
    { cmd: 7, tableAngle: 250.5, plateAngle: backEnd, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back" },
    { cmd: 3, tableAngle: 268.5, plateAngle: backTarget, action: "Orient Back for Re-Wipe - Agg 6", station: 6, section: "back", wipeResetReference: true },
    { cmd: 7, tableAngle: 270, plateAngle: backTarget, action: "Wipe Turn 1 Back - Agg 6", station: 6, section: "back" },
    { cmd: 7, tableAngle: 273, plateAngle: backTarget - 20, action: "Wipe Turn 2 Back - Agg 6", station: 6, section: "back" },
    { cmd: 3, tableAngle: 290, plateAngle: backEnd, action: "End Curve - Rest", station: 6, section: "back", terminalRest: true }
  ];
  state.motionPlan = { rows, stationPlans: [] };
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
  generatedAplMapDrivenProfile() { return baseRows(); },
  LabelerAplMapProfileGenerator: { generate() { return baseRows(); } },
  LabelerLabelCenterlinePolicy: {
    applicationReference(section) { return state.buildInputs[`${section}ApplicationReference`]; },
    sectionOffsetDeg() { return 0; },
    labelWidthDeg(section) { return section === "body" ? bodyDeg : backDeg; },
    finishedCenterlineFromApplication(section, angle) {
      return Number(angle) + (section === "body" ? bodyDeg : backDeg) / 2;
    },
    applicationTargetFromCenterline(section, center) {
      return Number(center) - (section === "body" ? bodyDeg : backDeg) / 2;
    }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "apl-first-tack-datum-flow-integration.js" });

const rows = context.generatedAplMapDrivenProfile(map);
const backApplication = rows.find((row) => row.station === 5 && row.section === "back" && row.applicationReference === true);
assert.ok(backApplication, "v44 must restore an explicit Back application reference when the upstream profile omitted it.");
assert.equal(Number(backApplication.cmd), 3);
const backIndex = rows.indexOf(backApplication);
assert.ok(backIndex > 0);
assert.equal(Number(rows[backIndex - 1].cmd), 7, "Back application must be reached by a Correction before the stopped reference.");
assert.equal(rows[backIndex - 1].applicationTransition, true);

const bodyReset = rows.find((row) => row.station === 4 && row.wipeResetReference === true);
const backReset = rows.find((row) => row.station === 6 && row.wipeResetReference === true);
assert.ok(bodyReset && backReset, "Second Body and Back aggregates must retain their re-wipe references.");
assert.equal(state.motionPlan.canonicalSectionHandoffV44, true);

let run = 0;
let maxRun = 0;
rows.forEach((row) => {
  run = Number(row.cmd) === 7 ? run + 1 : 0;
  maxRun = Math.max(maxRun, run);
});
assert.ok(maxRun <= 2, `Canonical section handoff produced ${maxRun} consecutive CMD 7 rows.`);

console.log("APL first-tack datum and canonical section-handoff v44 regression passed.");
