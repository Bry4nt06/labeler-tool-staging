"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");

function fixture(machineType = "MultiModul", aggregateCount = 3, enabledAggregates = null) {
  const map = {
    machineType,
    applicationMode: "apl",
    aggregateCount,
    stationCount: aggregateCount,
    ...(enabledAggregates ? { enabledAggregates } : {}),
    stationSections: { 1: "neck", 3: "body", 5: "back" },
    aggregateAngles: { 1: 68.5, 3: 148.5, 5: 238.5 },
    machineSettings: { zeroAngle: 0 },
    objects: [
      { station: 1, kind: "roller", side: "outer", application: "apl", start: 72, end: 82.5 },
      { station: 1, kind: "roller", side: "inner", application: "apl", start: 89.5, end: 100 },
      { station: 3, kind: "pad", side: "outer", application: "apl", start: 149, end: 169 },
      { station: 5, kind: "pad", side: "outer", application: "apl", start: 239, end: 259 }
    ]
  };
  const state = {
    applicationMode: "apl",
    maxMoveRatio: 21,
    buildInputs: {
      neckApplication: "Center",
      neckOverWipeDeg: 0,
      neckContactMm: 0,
      centerLineFrontDeg: 0,
      bodyOverWipeDeg: 0,
      bodyContactMm: 5,
      backContactMm: 5,
      backOverWipeDeg: 0
    }
  };
  const context = {
    console,
    state,
    ServoForgeStartupProgress: {},
    activeMachineMap: () => map,
    selectedLabelSpec: () => ({
      applicationMode: "apl",
      neckBottomCircumferenceMm: 360,
      neckBottomCurveMm: 389,
      bodyLengthMm: 70,
      backLengthMm: 53
    }),
    selectedBottleSpec: () => ({}),
    bodyCircumference: () => 200,
    normalizeLabelApplicationMode: value => value,
    num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    finishAngle: value => Math.round(Number(value) * 1000) / 1000,
    selectedLabelApplicationState: () => ({ neck: true, body: true, back: true }),
    sectionLabel: section => section[0].toUpperCase() + section.slice(1),
    inferAplStationSections: current => current.stationSections,
    norm: value => ((value % 360) + 360) % 360,
    normalizeBuilderObject: item => ({ ...item }),
    isStationEnabled: () => true,
    labelSectionForStation: station => map.stationSections[station],
    generatedAplSeedProfile: () => {
      const seed = [];
      seed[1] = { plateAngle: 0 };
      seed[11] = { plateAngle: -89 };
      seed[21] = { plateAngle: 91 };
      return seed;
    },
    profileTiming: { spenderArriveEarly: 7.5 },
    LabelerProfilePipelineDriver: { registerStage() {} },
    setTimeout() {},
    clearTimeout() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  for (const file of [
    "drivers/translation/topmodul-rpc-angle-driver.js",
    "drivers/geometry/label-geometry-driver.js",
    "app/wipe-analysis-service.js",
    "app/apl-map-profile-generation.js",
    "app/apl-roller-section-handoff-integration.js"
  ]) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  return { context, map };
}

for (const machineType of ["MultiModul", "TopModul (DTS3)"]) {
  test(`${machineType}: three aggregates with one neck station finish Turn 2 inside the contact window`, () => {
    const { context, map } = fixture(machineType, 3);
    const rows = context.generatedAplMapDrivenProfile(map);
    const first = rows.find(row => /Wipe Turn 1 Neck/.test(row.action));
    const secondIndex = rows.findIndex(row => /Wipe Turn 2 Neck/.test(row.action));
    const second = rows[secondIndex];
    const secondRest = rows[secondIndex + 1];
    const bodyCorrection = rows.slice(secondIndex + 2).find(row =>
      row.cmd === 7 && /Body Application/.test(row.action));

    assert.equal(first.plannedRotation, 194.5, "the established first wipe must not change");
    assert.equal(second.tableAngle, 89.5, "Turn 2 must start at the inside neck contact");
    assert.equal(secondRest.tableAngle, 100, "Turn 2 must finish at the physical inside-pad edge");
    assert.equal(second.plannedRotation, -194.5, "Turn 2 must reverse the complete first wipe while still in contact");
    assert.equal(second.physicalContactWindowComplete, true);
    assert.ok(bodyCorrection, "body orientation must be a separate move after the neck wipe");
    assert.ok(bodyCorrection.tableAngle > secondRest.tableAngle);

    const repaired = context.LabelerAplRollerSectionHandoff.repair(rows, 21, map);
    const preservedSecondIndex = repaired.rows.findIndex(row => /Wipe Turn 2 Neck/.test(row.action));
    assert.equal(repaired.rows[preservedSecondIndex + 1].tableAngle, 100,
      "late handoff processing must preserve the physical neck contact window");
  });
}

test("a six-position map with only three enabled aggregates uses the same contact-window rule", () => {
  const { context, map } = fixture("MultiModul", 6, [true, false, true, false, true, false]);
  const rows = context.generatedAplMapDrivenProfile(map);
  const secondIndex = rows.findIndex(row => /Wipe Turn 2 Neck/.test(row.action));

  assert.equal(rows[secondIndex].plannedRotation, -194.5);
  assert.equal(rows[secondIndex + 1].tableAngle, 100);
  assert.equal(rows[secondIndex].physicalContactWindowComplete, true);
});

test("six-aggregate layouts retain the established neck-to-body handoff", () => {
  const { context, map } = fixture("TopModul", 6);
  const rows = context.generatedAplMapDrivenProfile(map);
  const secondIndex = rows.findIndex(row => /Wipe Turn 2 Neck/.test(row.action));
  const second = rows[secondIndex];
  const secondRest = rows[secondIndex + 1];

  assert.equal(secondRest.tableAngle, 147.5);
  assert.equal(second.physicalContactWindowComplete, false);
  assert.equal(second.plannedRotation, -283.5);
});
