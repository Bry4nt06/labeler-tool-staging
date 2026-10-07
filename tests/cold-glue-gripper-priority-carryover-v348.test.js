"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const driverSource = fs.readFileSync(path.join(root, "drivers/mechanical/cold-glue-motion-driver.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");
const channelSource = fs.readFileSync(path.join(root, "app/cold-glue-gripper-channel-integration.js"), "utf8");

const enabled = [true, false, true, false, true, false];
const map = {
  id: "modelo-cold-glue",
  applicationMode: "cold-glue",
  headCount: 60,
  aggregateCount: 3,
  stationCount: 3,
  enabledAggregates: [...enabled],
  enabledStations: [...enabled],
  aggregateAngles: { "1": 81, "3": 156, "5": 232 },
  stationAngles: { "1": 81, "3": 156, "5": 232 },
  machineSettings: { direction: "ccw" },
  objects: [
    {
      id: "neck-channel-1",
      kind: "brush-channel",
      application: "cold-glue",
      station: 1,
      labelSection: "auto",
      outerStart: 110.6,
      outerEnd: 131,
      innerStart: 110.6,
      innerEnd: 156.7,
      start: 110.6,
      end: 156.7
    },
    {
      id: "body-channel-3",
      kind: "brush-channel",
      application: "cold-glue",
      station: 3,
      labelSection: "auto",
      outerStart: 178.2,
      outerEnd: 205.15,
      innerStart: 178.2,
      innerEnd: 205.15,
      start: 178.2,
      end: 205.15
    },
    {
      id: "neck-finisher-5",
      kind: "brush",
      application: "cold-glue",
      station: 5,
      labelSection: "neck",
      side: "outer",
      start: 212.2,
      end: 243
    }
  ]
};

const state = {
  headCount: 60,
  maxMoveRatio: 24,
  buildInputs: { plateStartPositionDeg: 0 },
  coldGlueMap: map.objects.map((item) => ({ ...item })),
  coldGlueAggregateSettings: {
    enabledAggregates: [...enabled],
    enabledStations: [...enabled],
    aggregateAngles: { ...map.aggregateAngles },
    machineSettings: { direction: "ccw" }
  },
  motionPlan: null
};

const context = {
  console,
  state,
  document: { readyState: "complete" },
  activeMachineMap: () => map,
  activeSlotNumbers: (slots) => slots.map((on, index) => on ? index + 1 : null).filter(Boolean),
  selectedLabelApplicationState: () => ({ neck: true, body: true, back: true }),
  selectedNeckWrapPlan: () => ({ resolvedMode: "standard" }),
  sectionWipePlan(section) {
    if (section === "neck") return { labelDeg: 327, overWipeDeg: 0 };
    if (section === "body") return { labelDeg: 173.436, overWipeDeg: 10 };
    return { labelDeg: 86.75, overWipeDeg: 10 };
  },
  inferredMapObjectStation: (item) => item.station,
  sectionLabel: (section) => section[0].toUpperCase() + section.slice(1),
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm(value) {
    const angle = Number(value) % 360;
    return angle < 0 ? angle + 360 : angle;
  },
  finishAngle: (value) => Math.round(Number(value) * 10) / 10,
  normalizeEnabledSlots(value, count) {
    const slots = Array.from({ length: 6 }, (_, index) => value?.[index] ?? index < count);
    if (!slots.some(Boolean)) slots[0] = true;
    return slots;
  },
  generatedAplSeedProfile: () => [],
  setTimeout() { throw new Error("Cold Glue gripper integration should install immediately"); },
  window: null
};
context.window = context;

vm.createContext(context);
vm.runInContext(driverSource, context, { filename: "cold-glue-motion-driver.js" });
vm.runInContext(profileSource, context, { filename: "cold-glue-profile-generation.js" });
vm.runInContext(channelSource, context, { filename: "cold-glue-gripper-channel-integration.js" });

const rows = context.generatedColdGlueFixedProfile();

const bodyApplication = rows.find((row) =>
  row.applicationReference === true
  && row.section === "body"
  && Number(row.station) === 3
);
assert.ok(bodyApplication, "the second application gripper must retain an explicit Body application reference");
assert.equal(bodyApplication.tableAngle, 156, "Body application must occur at the second gripper table datum");
assert.equal(bodyApplication.plateAngle, 0, "Body application must land on the same 0-degree bottle centerline as Neck");

const bodyIndex = rows.indexOf(bodyApplication);
const preBodyRows = rows.slice(0, bodyIndex);
assert.ok(preBodyRows.every((row) => Number(row.tableAngle) < 156),
  "Neck brush authority must end before the second gripper instead of carrying through Body application");

const neckCarryover = rows.filter((row) => row.carryoverWipe === true && row.section === "neck");
assert.ok(neckCarryover.length >= 2, "the later Station 5 neck brush must remain a Neck carry-over wipe");
assert.ok(neckCarryover.some((row) => row.carryoverPhase === "before-application"),
  "the neck finishing brush must use its available travel before the next gripper");
const carryoverTurnRows = neckCarryover.filter((row) => Number(row.cmd) === 7 && Number.isFinite(Number(row.plannedRotation)));
const totalCarryoverRotation = carryoverTurnRows.reduce((sum, row) => sum + Math.abs(Number(row.plannedRotation)), 0);
assert.ok(totalCarryoverRotation <= 327 / 2 + 0.001,
  "the neck finishing brush must not restart a full-label rotation after upstream wipe coverage");

const backApplication = rows.find((row) =>
  row.applicationReference === true
  && row.section === "back"
  && Number(row.station) === 5
);
assert.ok(backApplication, "the Station 5 Back application reference must remain present");
assert.equal(backApplication.tableAngle, 232);
assert.equal(backApplication.plateAngle, 180);

const lastPreCarry = Math.max(...neckCarryover
  .filter((row) => row.carryoverPhase === "before-application")
  .map((row) => Number(row.tableAngle)));
assert.ok(lastPreCarry < backApplication.tableAngle,
  "gripper priority requires the pre-application neck wipe to stop before the Back gripper");
const postCarryRows = neckCarryover.filter((row) => row.carryoverPhase === "after-application");
assert.equal(postCarryRows.length, 0,
  "Cold Glue finishing-brush rotation must never resume across a newly applied label after the gripper");

const bodyPreSpinTurn = rows.find((row) =>
  row.postApplicationBrushEntry === true
  && row.section === "body"
  && Number(row.station) === 3
  && Number(row.cmd) === 7
);
const bodyPreSpinReference = rows.find((row) =>
  row.postApplicationBrushEntry === true
  && row.section === "body"
  && Number(row.station) === 3
  && Number(row.cmd) === 3
);
assert.ok(bodyPreSpinTurn, "Body must begin rotating immediately after application toward the brush-channel entry");
assert.ok(bodyPreSpinReference, "Body must finish its pre-spin at the brush-channel entry reference");
assert.equal(bodyPreSpinTurn.tableAngle, 156,
  "Body pre-spin must start at the application gripper, not inside the brush channel");
assert.equal(bodyPreSpinReference.tableAngle, 178.2,
  "Body pre-spin must be complete when the bottle reaches the simultaneous brush-channel entry");
assert.equal(bodyPreSpinReference.plateAngle, -90,
  "CCW-stored MAB1 must face the body label into the parallel brush channel before contact");

console.log("Cold Glue gripper-priority and cross-station neck carry-over regression passed.");
