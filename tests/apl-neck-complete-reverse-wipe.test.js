"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function fixture(machineType) {
  const map = { machineType, applicationMode: "apl", stationSections: { 1: "neck", 3: "body", 5: "back" },
    aggregateAngles: { 1: 68.5, 3: 148.5, 5: 238.5 }, machineSettings: { zeroAngle: 0 }, objects: [
    { station: 1, kind: "roller", side: "outer", application: "apl", start: 72, end: 82.5 },
    { station: 1, kind: "roller", side: "inner", application: "apl", start: 89.5, end: 147.5 },
    { station: 3, kind: "pad", side: "outer", application: "apl", start: 149, end: 169 },
    { station: 5, kind: "pad", side: "outer", application: "apl", start: 239, end: 259 }
  ] };
  const state = { applicationMode: "apl", maxMoveRatio: 21, buildInputs: {
    neckApplication: "Center", neckOverWipeDeg: 0, neckContactMm: 0,
    centerLineFrontDeg: 0, bodyOverWipeDeg: 0, bodyContactMm: 5, backContactMm: 5, backOverWipeDeg: 0
  } };
  const stages = new Map();
  const context = {
    console, state, ServoForgeStartupProgress: {},
    activeMachineMap: () => map,
    selectedLabelSpec: () => ({ applicationMode: "apl", neckBottomCircumferenceMm: 360,
      neckBottomCurveMm: 389, bodyLengthMm: 70, backLengthMm: 53 }),
    selectedBottleSpec: () => ({}), bodyCircumference: () => 200,
    normalizeLabelApplicationMode: value => value,
    num: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    finishAngle: value => Math.round(value * 1000) / 1000,
    selectedLabelApplicationState: () => ({ neck: true, body: true, back: true }),
    sectionLabel: section => section[0].toUpperCase() + section.slice(1),
    inferAplStationSections: m => m.stationSections,
    norm: value => ((value % 360) + 360) % 360,
    normalizeBuilderObject: item => ({ ...item }),
    isStationEnabled: () => true,
    labelSectionForStation: station => map.stationSections[station],
    generatedAplSeedProfile: () => { const seed = []; seed[1] = { plateAngle: 0 }; seed[11] = { plateAngle: -89 }; seed[21] = { plateAngle: 91 }; return seed; },
    profileTiming: { spenderArriveEarly: 7.5 },
    LabelerLabelCenterlinePolicy: {
      applicationReference: section => section === "neck" ? "center-tack" : "leading-edge",
      applicationTargetFromCenterline: section => section === "neck" ? 0 : section === "body" ? -89 : 91
    },
    generatedAplMapDrivenProfile: () => [],
    LabelerProfilePipelineDriver: { registerStage: stage => stages.set(stage.id, stage) },
    setTimeout() {}, clearTimeout() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  for (const file of ["drivers/translation/topmodul-rpc-angle-driver.js", "drivers/geometry/label-geometry-driver.js",
    "app/wipe-analysis-service.js", "app/apl-map-profile-generation.js", "app/apl-finished-centerline-completion-integration.js",
    "app/apl-roller-section-handoff-integration.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), context, { filename: file });
  }
  return { context, map, state, stages };
}

for (const machine of ["MultiModul", "TopModul (DTS3)", "TopModul (DTS4)", "Autocol"]) {
  for (const kind of ["roller", "dual-pad", "single-pad"]) {
    test(`${machine} ${kind}: generated three-station profile completes neck and reaches body within one cycle`, () => {
      const { context, map } = fixture(machine);
      if (kind !== "roller") {
        map.objects[0].kind = map.objects[1].kind = "pad";
        map.objects[1].end = 140;
      }
      if (kind === "single-pad") {
        map.objects[0].end = 140;
        map.objects.splice(1, 1);
      }
      const rows = context.generatedAplMapDrivenProfile(map);
      const first = rows.find(row => /Wipe Turn 1 Neck/.test(row.action));
      const second = rows.find(row => /Wipe Turn 2 Neck/.test(row.action));
      assert.ok(second.plannedRotation <= -(Math.abs(first.plannedRotation) + 194.5));
      assert.ok(rows.every(row => row.tableAngle < 360), "handoff must not push body into a second cycle");
      assert.ok(rows.filter(row => row.cmd === 7).every(row => row.plannedRatio < 21), "fixture must fit the existing servo ratio limit");
    });
  }
}

for (const machine of ["MultiModul", "Autocol", "TopModul", "TopModul (DTS3)", "TopModul (DTS4)"]) {
  test(`${machine}: one neck station completes the reverse wipe without changing the first turn`, () => {
    const { context, map } = fixture(machine);
    const plan = context.sectionWipePlan("neck");
    assert.equal(plan.stages[0].requiredRotation, 194.5);
    assert.equal(plan.stages[1].requiredRotation, 389, "reverse travel must reach the opposite edge, not just the tack center");
    const rows = [
      { cmd: 7, tableAngle: 72, plateAngle: 0, station: 1, section: "neck", action: "Wipe Turn 1 Neck - Agg 1", plannedRotation: 194.5 },
      { cmd: 3, tableAngle: 82.5, plateAngle: 194.5, station: 1, section: "neck", action: "Wipe Turn 1 Neck - Agg 1 - Rest" },
      { cmd: 7, tableAngle: 89.5, plateAngle: 194.5, station: 1, section: "neck", action: "Wipe Turn 2 Neck - Agg 1", plannedRotation: -283.5 },
      { cmd: 3, tableAngle: 147.5, plateAngle: -89, station: 1, section: "neck", action: "Wipe Hold Neck - Agg 1" }
    ];
    const corrected = context.LabelerAplFinishedCenterlineCompletion.correctGeneratedProfile(rows, map);
    assert.equal(corrected[0].plannedRotation, 194.5);
    assert.ok(corrected[2].plannedRotation <= -389, "finalized rows must not preserve the shortened second wipe");
    assert.ok(corrected[3].plateAngle <= -194.5);
  });
}

test("roller handoff must not shorten an already complete reverse wipe", () => {
  const { context, map } = fixture("MultiModul");
  const rows = [
    { cmd: 7, tableAngle: 89.5, plateAngle: 194.5, station: 1, section: "neck", action: "Wipe Turn 2 Neck - Agg 1" },
    { cmd: 3, tableAngle: 147.5, plateAngle: -194.5, station: 1, section: "neck", action: "Wipe Hold Neck - Agg 1" },
    { cmd: 7, tableAngle: 148, plateAngle: -194.5, action: "Servo Correction" },
    { cmd: 3, tableAngle: 148.5, plateAngle: -89, action: "Reference" },
    { cmd: 7, tableAngle: 149, plateAngle: -89, station: 3, section: "body", action: "Wipe Turn 1 Body - Agg 3" }
  ];
  const result = context.LabelerAplRollerSectionHandoff.repair(rows, 21, map);
  assert.ok(result.rows[1].plateAngle - result.rows[0].plateAngle <= -389,
    "a nearest-equivalent body reference must not undo the full neck wipe");
});
