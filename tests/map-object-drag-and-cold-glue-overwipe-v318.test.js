"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const controllerSource = fs.readFileSync(path.join(root, "app/controllers/map-controller.js"), "utf8");
const sceneSource = fs.readFileSync(path.join(root, "app/mechanical-map-scene-renderer.js"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "app/cold-glue-profile-generation.js"), "utf8");
const brushVisualSource = fs.readFileSync(path.join(root, "app/cold-glue-brush-visual-integration.js"), "utf8");
const brushPanelSource = fs.readFileSync(path.join(root, "app/cold-glue-brush-bevel-back-panel-v23.js"), "utf8");
const channelSource = fs.readFileSync(path.join(root, "app/cold-glue-gripper-channel-integration.js"), "utf8");

const item = {
  id: 42,
  name: "Station brush",
  kind: "brush-channel",
  start: 10,
  end: 30,
  outerStart: 10,
  outerEnd: 30,
  innerStart: 12,
  innerEnd: 32
};
const machineMap = { objects: [item] };
const objectNode = { dataset: { mapObjectId: "42" } };
const overlayNode = { closest: () => null };
const svg = {
  contains: (node) => node === objectNode || node === overlayNode,
  createSVGPoint() {
    return {
      x: 0,
      y: 0,
      matrixTransform() { return { x: this.x, y: this.y }; }
    };
  },
  getScreenCTM: () => ({ inverse: () => ({}) }),
  setPointerCapture() {},
  hasPointerCapture: () => false,
  classList: { add() {}, remove() {}, toggle() {} }
};
const state = {
  mapLocked: false,
  direction: "ccw",
  zeroAngle: 0,
  previewAngle: 0,
  mapPanX: 0,
  mapPanY: 0,
  mapZoom: 1,
  builderHistory: { undo: [] }
};
const calls = [];
const actionService = {
  call(name, ...args) {
    calls.push([name, ...args]);
    if (name === "editableMachineMap") return machineMap;
    if (name === "deepClone") return JSON.parse(JSON.stringify(args[0]));
    return undefined;
  },
  execute(options = {}) {
    options.mutate?.();
    return undefined;
  },
  render() {},
  number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
};
const context = {
  console,
  state,
  els: { mapSvg: svg },
  document: { elementsFromPoint: () => [overlayNode, { closest: () => objectNode }] },
  LabelerWorkspaceActionService: actionService,
  signedAngleDifference: (left, right) => left - right,
  norm: (value) => ((value % 360) + 360) % 360,
  window: null
};
context.window = context;
vm.createContext(context);
vm.runInContext(controllerSource, context, { filename: "map-controller.js" });

const pointerDown = {
  button: 0,
  pointerId: 7,
  clientX: 1,
  clientY: 0,
  target: overlayNode
};
assert.equal(context.LabelerMapController.beginPointer(pointerDown), true,
  "an overlay-covered station object must still acquire the map drag");
assert.equal(state.selectedMapObjectId, "42",
  "numeric persisted IDs must match their SVG string representation");
assert.equal(context.LabelerMapController.movePointer({ ...pointerDown, clientX: 0, clientY: 1 }), true);
assert.equal(item.start, 100, "dragging must rotate the canonical station object");
assert.equal(item.outerStart, 100);
assert.equal(item.innerStart, 102);

assert.match(sceneSource, /Active servo move distance overlay", "pointer-events": "none"/);
assert.match(sceneSource, /All servo program moves overlay", "pointer-events": "none"/);
assert.match(sceneSource, /Servo move fault overlay", "pointer-events": "none"/);

assert.match(profileSource, /overWipeDeg: section === "neck" \? 0 : wipe\.overWipeDeg/,
  "the canonical Cold Glue planner must ignore the APL neck over-wipe input");
assert.match(channelSource, /const overWipeDeg = 0;/,
  "the legacy channel adapter must enforce the same Cold Glue rule");

const visualContext = { console, window: null };
visualContext.window = visualContext;
vm.createContext(visualContext);
vm.runInContext(brushVisualSource, visualContext, { filename: "cold-glue-brush-visual-integration.js" });
const brushRange = visualContext.ServoForgeColdGlueBrushVisualIntegration.brushRange;
const standaloneRange = brushRange({
  kind: "brush",
  side: "outer",
  start: 140,
  end: 165,
  outerStart: 20,
  outerEnd: 45
}, "outer");
assert.equal(standaloneRange.start, 140,
  "a standalone brush visual must follow its live start value instead of its creation-time side alias");
assert.equal(standaloneRange.end, 165,
  "a standalone brush visual must follow its live end value instead of its creation-time side alias");
const channelRange = brushRange({
  kind: "brush-channel",
  start: 10,
  end: 50,
  outerStart: 20,
  outerEnd: 45
}, "outer");
assert.equal(channelRange.start, 20,
  "a combined brush channel must retain its independent outside range");
assert.equal(channelRange.end, 45);

vm.runInContext(brushPanelSource, visualContext, { filename: "cold-glue-brush-bevel-back-panel-v23.js" });
const panelBrushRange = visualContext.ServoForgeColdGlueBrushBevelBackPanel.brushRange;
const standalonePanelRange = panelBrushRange({
  kind: "brush",
  side: "outer",
  start: 140,
  end: 165,
  outerStart: 20,
  outerEnd: 45
}, "outer");
assert.equal(standalonePanelRange.start, 140,
  "the standalone brush bristle and back-panel layers must follow the same live range as the texture lines");
assert.equal(standalonePanelRange.end, 165,
  "the complete standalone brush assembly must move together after a drag");
const channelPanelRange = panelBrushRange({
  kind: "brush-channel",
  start: 10,
  end: 50,
  outerStart: 20,
  outerEnd: 45
}, "outer");
assert.equal(channelPanelRange.start, 20,
  "the panel wrapper must preserve independent outside geometry for combined brush channels");
assert.equal(channelPanelRange.end, 45);

const profileContext = {
  console,
  state: {
    applicationMode: "cold-glue",
    coldGlueAggregateSettings: {
      enabledStations: [true, false, false, false, false, false],
      enabledAggregates: [true, false, false, false, false, false],
      aggregateAngles: { "1": 68.5 },
      machineSettings: { direction: "ccw" }
    },
    coldGlueMap: [{
      id: "station-1-channel",
      kind: "brush-channel",
      station: 1,
      start: 100,
      end: 120,
      outerStart: 100,
      outerEnd: 120,
      innerStart: 110,
      innerEnd: 130
    }],
    buildInputs: { plateStartPositionDeg: 0 },
    maxMoveRatio: 21,
    headCount: 60
  },
  activeMachineMap: () => ({
    applicationMode: "cold-glue",
    enabledStations: [true, false, false, false, false, false],
    enabledAggregates: [true, false, false, false, false, false],
    aggregateAngles: { "1": 68.5 },
    machineSettings: { direction: "ccw" }
  }),
  activeSlotNumbers: (slots) => slots.map((enabled, index) => enabled ? index + 1 : null).filter(Boolean),
  selectedLabelApplicationState: () => ({ neck: true, body: false, back: false }),
  generatedAplSeedProfile: () => [{ plateAngle: 0 }, { plateAngle: 120 }],
  sectionWipePlan: () => ({ labelDeg: 350, overWipeDeg: 0 }),
  selectedNeckWrapPlan: () => ({ resolvedMode: "standard" }),
  inferredMapObjectStation: (entry) => entry.station,
  sectionLabel: (section) => section[0].toUpperCase() + section.slice(1),
  num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  },
  norm: (value) => ((Number(value) % 360) + 360) % 360,
  finishAngle: (value) => Math.round(Number(value) * 2) / 2,
  window: null
};
profileContext.window = profileContext;
profileContext.LabelerServoCommandDriver = { finalize: (rows) => rows };
profileContext.LabelerColdGlueMotionDriver = {
  applicationTarget: (baseTarget, direction, labelDeg) => Number(labelDeg) >= 330
    ? (direction === "ccw" ? 120 : -120)
    : baseTarget,
  flowFacingTarget: () => 0,
  createBrushChannelPlan: () => ({
    fullWrap: true,
    labelDeg: 350,
    brushEntryLeadDeg: 0,
    channelMoves: [{
      stage: "outer",
      side: "outer",
      start: 100,
      end: 120,
      rotation: 40,
      direction: 1,
      ratio: 2,
      centerTackStage: "center-to-first-edge"
    }],
    issues: []
  })
};
vm.createContext(profileContext);
vm.runInContext(profileSource, profileContext, { filename: "cold-glue-profile-generation.js" });
const stationOneRows = profileContext.generatedColdGlueFixedProfile();
assert.equal(stationOneRows.some((row) => /Turn for Neck Application/.test(row.action)), false,
  "Station 1 must remain at the zero datum through Aggregate 1");
assert.equal(stationOneRows.some((row) => /Face Bottle With Flow|Pre-Spin/.test(row.action)), false,
  "a zero-degree brush-entry target must not emit a redundant pre-brush correction");
const firstStationTurn = stationOneRows.find((row) => Number(row.cmd) === 7);
assert.equal(firstStationTurn.tableAngle, 100,
  "the first Station 1 correction must begin at the physical brush window");
assert.equal(firstStationTurn.plateAngle, 0,
  "Station 1 must enter the brush at the zero-degree datum");

profileContext.state.coldGlueAggregateSettings.enabledStations = [true, false, true, false, false, false];
profileContext.state.coldGlueAggregateSettings.enabledAggregates = [true, false, true, false, false, false];
profileContext.state.coldGlueAggregateSettings.aggregateAngles = { "1": 68.5, "3": 137 };
profileContext.activeMachineMap = () => ({
  applicationMode: "cold-glue",
  enabledStations: [true, false, true, false, false, false],
  enabledAggregates: [true, false, true, false, false, false],
  aggregateAngles: { "1": 68.5, "3": 137 },
  machineSettings: { direction: "ccw" }
});
profileContext.selectedLabelApplicationState = () => ({ neck: true, body: true, back: false });
profileContext.generatedAplSeedProfile = () => Array.from(
  { length: 22 },
  (_, index) => ({ plateAngle: index === 11 ? 90 : 0 })
);
const handoffRows = profileContext.generatedColdGlueFixedProfile();
const neckWipeRestIndex = handoffRows.findIndex((row) =>
  Number(row.cmd) === 3 && /Neck Outside Brush Opening.*Rest/.test(row.action)
);
assert.notEqual(neckWipeRestIndex, -1, "the test profile must include the outside brush exit Rest");
const neckWipeRest = handoffRows[neckWipeRestIndex];
const bodyTurn = handoffRows[neckWipeRestIndex + 1];
const bodyReference = handoffRows[neckWipeRestIndex + 2];
assert.equal(Number(bodyTurn.cmd), 7,
  "the post-wipe handoff must start with a Correction for the next aggregate");
assert.equal(bodyTurn.plateAngle, neckWipeRest.plateAngle,
  "the next-aggregate Correction must start from the achieved outside-wipe angle without snapping");
assert.ok(bodyTurn.tableAngle > neckWipeRest.tableAngle,
  "the handoff Correction needs its own strictly increasing table waypoint");
assert.equal(Number(bodyReference.cmd), 3,
  "the next aggregate target must be stored on a Rest reference");
assert.equal(bodyReference.tableAngle, 137,
  "the target Rest must occur at Aggregate 3 instead of being stretched to a remote end-of-curve object");
assert.equal(bodyReference.plateAngle, 90,
  "the bottle must reach its configured Body application orientation at Aggregate 3");
assert.equal(bodyReference.terminalRest, true,
  "a missing downstream brush set must preserve the Aggregate 3 application reference as the terminal Rest");

console.log("Map object drag, unified standalone brush rendering, Station 1 zero datum, Cold Glue neck over-wipe, and next-aggregate handoff regression passed.");
