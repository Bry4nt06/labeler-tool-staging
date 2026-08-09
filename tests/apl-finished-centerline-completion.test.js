"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "apl-finished-centerline-completion-integration.js"), "utf8");

const effectiveDiameterMm = 60.68 - 2 * 0.3;
const circumferenceMm = effectiveDiameterMm * Math.PI;
const bodyLengthMm = 64.897;
const backLengthMm = 47.498;
const bodyDeg = bodyLengthMm / circumferenceMm * 360;
const backDeg = backLengthMm / circumferenceMm * 360;
const tenDegMm = circumferenceMm * 10 / 360;

const state = {
  applicationMode: "apl",
  maxMoveRatio: 21,
  buildInputs: {
    centerLineFrontDeg: 0,
    bodyApplicationReference: "leading-edge",
    backApplicationReference: "leading-edge",
    bodyOffsetMm: 0,
    backOffsetMm: 0,
    bodyContactMm: tenDegMm,
    backContactMm: tenDegMm,
    bodyOverWipeDeg: 0,
    backOverWipeDeg: 0
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

function rowsBase() {
  const rows = [
    { cmd:3, tableAngle:0, plateAngle:0, action:"Zero Line" },
    { cmd:7, tableAngle:0.5, plateAngle:0, action:"Hold for Body Application - Agg 3", station:3, section:"body" },
    { cmd:3, tableAngle:141, plateAngle:0, action:"Hold for Body Application - Agg 3", station:3, section:"body" },
    { cmd:7, tableAngle:149, plateAngle:0, action:"Wipe Turn 1 Body - Agg 3", station:3, section:"body", plannedRotation:-10 },
    { cmd:7, tableAngle:154, plateAngle:-10, action:"Wipe Turn 2 Body - Agg 3", station:3, section:"body", plannedRotation:bodyDeg },
    { cmd:3, tableAngle:169, plateAngle:-10+bodyDeg, action:"Wipe Hold Body - Agg 3", station:3, section:"body" },
    { cmd:7, tableAngle:169.5, plateAngle:-10+bodyDeg, action:"Hold for Body Application - Agg 4", station:4, section:"body" },
    { cmd:3, tableAngle:181, plateAngle:0, action:"Hold for Body Application - Agg 4", station:4, section:"body" },
    { cmd:7, tableAngle:189, plateAngle:0, action:"Wipe Turn 1 Body - Agg 4", station:4, section:"body", plannedRotation:-10 },
    { cmd:7, tableAngle:194, plateAngle:-10, action:"Wipe Turn 2 Body - Agg 4", station:4, section:"body", plannedRotation:bodyDeg },
    { cmd:3, tableAngle:209, plateAngle:-10+bodyDeg, action:"Wipe Hold Body - Agg 4", station:4, section:"body" },
    { cmd:7, tableAngle:209.5, plateAngle:-10+bodyDeg, action:"Hold for Back Application - Agg 5", station:5, section:"back" },
    { cmd:3, tableAngle:222, plateAngle:180, action:"Hold for Back Application - Agg 5", station:5, section:"back" },
    { cmd:7, tableAngle:230, plateAngle:180, action:"Wipe Turn 1 Back - Agg 5", station:5, section:"back", plannedRotation:-10 },
    { cmd:7, tableAngle:235, plateAngle:170, action:"Wipe Turn 2 Back - Agg 5", station:5, section:"back", plannedRotation:backDeg },
    { cmd:3, tableAngle:250, plateAngle:170+backDeg, action:"Wipe Hold Back - Agg 5", station:5, section:"back" },
    { cmd:7, tableAngle:250.5, plateAngle:170+backDeg, action:"Hold for Back Application - Agg 6", station:6, section:"back" },
    { cmd:3, tableAngle:262, plateAngle:180, action:"Hold for Back Application - Agg 6", station:6, section:"back" },
    { cmd:7, tableAngle:270, plateAngle:180, action:"Wipe Turn 1 Back - Agg 6", station:6, section:"back", plannedRotation:-10 },
    { cmd:7, tableAngle:275, plateAngle:170, action:"Wipe Turn 2 Back - Agg 6", station:6, section:"back", plannedRotation:backDeg },
    { cmd:3, tableAngle:290, plateAngle:170+backDeg, action:"End Curve - Rest", station:6, section:"back", terminalRest:true }
  ];
  state.motionPlan = {rows, stationPlans:[
    {station:3,section:"body"}, {station:4,section:"body"}, {station:5,section:"back"}, {station:6,section:"back"}
  ]};
  return rows;
}

const context = {
  console, state,
  setTimeout() {},
  finishAngle(v){ return Math.round(Number(v)*10)/10; },
  selectedLabelApplicationState(){ return {neck:false,body:true,back:true}; },
  inferAplStationSections(m){ return {...m.stationSections}; },
  labelSectionForStation(station){ return station <=4 ? "body":"back"; },
  sectionLabel(s){ return s[0].toUpperCase()+s.slice(1); },
  selectedLabelSpec(){ return {bodyLengthMm,backLengthMm,neckBottomCircumferenceMm:0}; },
  selectedBottleSpec(){ return {}; },
  bodyCircumference(){ return circumferenceMm; },
  sectionWipePlan(){ return null; },
  generatedAplMapDrivenProfile(){ return rowsBase(); },
  LabelerAplMapProfileGenerator:{generate(){return rowsBase();}},
  LabelerGeometryDriver:{
    solveSection({mode,labelLengthMm,circumferenceMm: c,contactMm,overWipeDeg}) {
      const labelDeg = Number(labelLengthMm)/Number(c)*360;
      const over = Number(overWipeDeg||0);
      if (mode === "center-tack-two-stage") {
        const stageRequired = labelDeg/2+over;
        return {mode,labelDeg,stageRequired,totalRequired:stageRequired*2,stages:[{requiredRotation:stageRequired},{requiredRotation:stageRequired}]};
      }
      const contactDeg = Number(contactMm||0)/Number(c)*360;
      return {mode,labelDeg,backSpinRequired:contactDeg+over,forwardWipeRequired:labelDeg+2*over,
        stages:[{requiredRotation:contactDeg+over},{requiredRotation:labelDeg+2*over}]};
    }
  },
  LabelerLabelCenterlinePolicy:{
    applicationReference(section){ return state.buildInputs[`${section}ApplicationReference`] || "center-tack"; },
    sectionOffsetDeg(){return 0;},
    labelWidthDeg(section){ return section==="body"?bodyDeg:backDeg; },
    applicationTargetFromCenterline(section,center,mode){ return mode==="leading-edge"?center-(section==="body"?bodyDeg:backDeg)/2:center; }
  }
};
context.window=context; context.globalThis=context;
vm.createContext(context);
vm.runInContext(source, context);

const rows=context.generatedAplMapDrivenProfile(map);
assert.equal(state.motionPlan.applicationDatumOffset,0);
assert.equal(state.motionPlan.centerlineRecoveryRequired,false);
assert.equal(state.motionPlan.finishedCenterlines.body,0);
assert.equal(state.motionPlan.finishedCenterlines.back,180);
assert.ok(!rows.some(r=>/Return .*Finished Centerline|Hold Finished/.test(r.action)));

const body3=rows.find(r=>r.station===3 && r.applicationReference);
const body4=rows.find(r=>r.station===4 && r.wipeResetReference);
const back5=rows.find(r=>r.station===5 && r.applicationReference);
const back6=rows.find(r=>r.station===6 && r.wipeResetReference);
assert.ok(body3 && body4 && back5 && back6);
assert.match(body4.action,/Re-Wipe/);
assert.match(back6.action,/Re-Wipe/);

const appLike=rows.filter(r=>/Application/.test(r.action));
assert.equal(appLike.filter(r=>r.section==="body").length,1);
assert.equal(appLike.filter(r=>r.section==="back").length,1);

for (let i=0;i<rows.length-1;i++) {
  if (Number(rows[i].cmd)!==7) continue;
  const span=rows[i+1].tableAngle-rows[i].tableAngle;
  const rot=rows[i+1].plateAngle-rows[i].plateAngle;
  const ratio=Math.abs(rot)/span;
  assert.ok(ratio<=21+1e-9, `HMI ${i+1} ratio ${ratio}`);
}
console.log("APL label-datum servo-flow regression passed");
