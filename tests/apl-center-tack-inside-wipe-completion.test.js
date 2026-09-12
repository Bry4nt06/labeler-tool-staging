"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const geometrySource = fs.readFileSync(
  path.join(root, "drivers", "geometry", "label-geometry-driver.js"),
  "utf8"
);
const generatorSource = fs.readFileSync(
  path.join(root, "app", "apl-map-profile-generation.js"),
  "utf8"
);
const rpcAngleSource = fs.readFileSync(
  path.join(root, "drivers", "translation", "topmodul-rpc-angle-driver.js"),
  "utf8"
);
const telemetrySource = fs.readFileSync(
  path.join(root, "app", "wipe-telemetry-service.js"),
  "utf8"
);

const labelLengthMm = 81.54;
const neckCircumferenceMm = 105;
const labelDeg = labelLengthMm / neckCircumferenceMm * 360;

const state = {
  applicationMode: "apl",
  zeroAngle: 0,
  maxMoveRatio: 21,
  buildInputs: {
    plateStartPositionDeg: 0,
    neckApplication: "Center",
    neckContactMm: 0,
    neckOverWipeDeg: 0
  },
  motionPlan: null
};

const context = {
  console,
  Math,
  Number,
  ServoForgeStartupProgress: {},
  state,
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm(value) {
    return ((Number(value) % 360) + 360) % 360;
  },
  finishAngle(value) {
    return Math.round(Number(value) * 1000) / 1000;
  },
  normalizeBuilderObject(item) {
    return { ...item };
  },
  isStationEnabled() {
    return true;
  },
  inferAplStationSections(machineMap) {
    return { ...machineMap.stationSections };
  },
  labelSectionForStation(station) {
    return Number(station) === 1 ? "neck" : "body";
  },
  selectedLabelApplicationState() {
    return { neck: true, body: true, back: false };
  },
  generatedAplSeedProfile() {
    const seed = [];
    seed[1] = { plateAngle: 0 };
    seed[11] = { plateAngle: 0 };
    seed[21] = { plateAngle: 180 };
    return seed;
  },
  sectionLabel(section) {
    return section[0].toUpperCase() + section.slice(1);
  },
  labelSensorInspectionCenter() {
    return 0;
  },
  labelSensorVisibility() {
    return { percent: 100 };
  },
  nearestLabelSensorTarget() {
    return { target: 0, visibility: { percent: 100 } };
  },
  selectedLabelSpec() {
    return {
      neckBottomCurveMm: labelLengthMm,
      neckLengthMm: labelLengthMm,
      neckBottomCircumferenceMm: neckCircumferenceMm
    };
  },
  selectedBottleSpec() {
    return {};
  },
  bodyCircumference() {
    return 182.212;
  },
  degFromMm(length, circumference) {
    return Number(length) / Number(circumference) * 360;
  },
  programSegments(program) {
    return program.slice(0, -1).map((row, index) => ({
      ...row,
      tableTravel: Number(program[index + 1].tableAngle) - Number(row.tableAngle),
      plateTravel: Number(program[index + 1].plateAngle) - Number(row.plateAngle)
    }));
  },
  profileTiming: { spenderArriveEarly: 7.5 }
};
context.window = context;
context.globalThis = context;

vm.createContext(context);
vm.runInContext(rpcAngleSource, context, { filename: "topmodul-rpc-angle-driver.js" });
vm.runInContext(geometrySource, context, { filename: "label-geometry-driver.js" });
context.sectionWipePlan = (section) => context.LabelerGeometryDriver.solveSection({
  mode: section === "neck" ? "center-tack-two-stage" : "leading-edge",
  labelLengthMm: section === "neck" ? labelLengthMm : 70,
  circumferenceMm: section === "neck" ? neckCircumferenceMm : 182.212,
  contactMm: section === "neck" ? 0 : 5,
  overWipeDeg: 0,
  completeCenterTackInsideWipe:
    context.LabelerTopModulRpcAngleDriver.variant(context.activeMachineMap?.()?.machineType) === "dts3"
});
vm.runInContext(generatorSource, context, { filename: "apl-map-profile-generation.js" });

context.activeMachineMap = () => ({ machineType: "TopModul (DTS3)" });
const wipePlan = context.sectionWipePlan("neck");
assert.ok(Math.abs(wipePlan.stages[0].requiredRotation - labelDeg / 2) < 1e-9);
assert.ok(
  Math.abs(wipePlan.stages[1].requiredRotation - labelDeg) < 1e-9,
  "the inside turn must travel from the first wiped edge through center to the opposite label edge"
);
assert.ok(Math.abs(wipePlan.totalRequired - labelDeg * 1.5) < 1e-9);

const machineMap = {
  machineType: "TopModul (DTS3)",
  applicationMode: "apl",
  machineSettings: { zeroAngle: 0 },
  aggregateAngles: { "1": 68.5, "3": 148.5 },
  stationAngles: { "1": 68.5, "3": 148.5 },
  stationSections: { "1": "neck", "3": "body" },
  objects: [
    { id: "outside", kind: "pad", application: "apl", station: 1, side: "outer", start: 80, end: 88 },
    { id: "inside", kind: "pad", application: "apl", station: 1, side: "inner", start: 90, end: 140 },
    { id: "body", kind: "pad", application: "apl", station: 3, side: "outer", start: 149, end: 169 }
  ]
};
context.activeMachineMap = () => machineMap;

const rows = context.generatedAplMapDrivenProfile(machineMap);

const turn1 = rows.find((row) => /Wipe Turn 1 Neck/.test(row.action));
const turn2 = rows.find((row) => /Wipe Turn 2 Neck/.test(row.action));
const rest = rows.find((row) => /Wipe Turn 2 Neck - Agg 1 - Rest/.test(row.action));

assert.ok(turn1 && turn2 && rest, "the map-driven profile must contain both neck wipe turns and the final rest");
assert.ok(Math.abs(turn1.plannedRotation - labelDeg / 2) < 0.001);
assert.ok(
  turn2.plannedRotation <= -labelDeg,
  "the generated inside turn must wipe the complete remaining path, not return only to the tack center"
);
assert.ok(
  Math.abs(rest.plateAngle % 360) < 0.001,
  "after reaching the opposite label edge, the inside wipe may continue to a modulo-equivalent next-aggregate reference"
);
assert.ok(rows.every((row) => row.tableAngle < 360), "the next aggregate must remain in the same machine cycle");

vm.runInContext(telemetrySource, context, { filename: "wipe-telemetry-service.js" });
const coverage = context.LabelerWipeTelemetryService.contactedLabelCoverage(
  rows,
  "neck",
  1,
  rest.tableAngle,
  context.LabelerWipeTelemetryService.wipeVisualApplication("neck", labelLengthMm)
);
assert.equal(coverage.percentage, 100, "the wipe-down panel must show the neck label fully wiped after Turn 2");

console.log("APL center-tack inside wipe completion regression passed.");


const legacyWipePlan = context.LabelerGeometryDriver.solveSection({
  mode: "center-tack-two-stage",
  labelLengthMm,
  circumferenceMm: neckCircumferenceMm,
  contactMm: 0,
  overWipeDeg: 0,
  completeCenterTackInsideWipe: false
});
assert.ok(Math.abs(legacyWipePlan.stages[0].requiredRotation - labelDeg / 2) < 1e-9);
assert.ok(Math.abs(legacyWipePlan.stages[1].requiredRotation - labelDeg / 2) < 1e-9);
assert.ok(Math.abs(legacyWipePlan.totalRequired - labelDeg) < 1e-9);

const dts4Map = { ...machineMap, machineType: "TopModul (DTS4)" };
context.activeMachineMap = () => dts4Map;
const dts4Rows = context.generatedAplMapDrivenProfile(dts4Map);
const dts4Turn2 = dts4Rows.find((row) => /Wipe Turn 2 Neck/.test(row.action));
assert.ok(dts4Turn2, "the established DTS4 profile must retain its inside neck turn");
assert.ok(
  Math.abs(dts4Turn2.plannedRotation + labelDeg / 2) < 0.001,
  "non-DTS3 maps must retain the established half-label inside turn"
);
