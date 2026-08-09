"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"app","first-application-zero-datum-integration.js"),"utf8");

const state={
  applicationMode:"apl",
  selectedBrand:"12oz LandShark (LN)",
  buildInputs:{neckSpenderPlateDeg:75,neckApplication:"Center",plateStartPositionDeg:15},
  labelSpecs:[{applicationMode:"apl",brand:"12oz LandShark (LN)",bodyLengthMm:64.897,backLengthMm:47.498}],
  motionPlan:null
};
const map={
  stationSections:{"1":"neck","2":"neck","3":"body","4":"body","5":"back","6":"back"},
  objects:[{kind:"roller",station:1},{kind:"roller",station:2},{kind:"pad",station:3},{kind:"pad",station:4},{kind:"pad",station:5},{kind:"pad",station:6}]
};
const inputs=new Map();
const context={
  console,state,
  document:{getElementById(id){if(!inputs.has(id)) inputs.set(id,{id,value:""}); return inputs.get(id);}},
  setTimeout() {},
  saveCurrentSettings(){},applyGeneratedServoProfile(){},render(){},
  selectedLabelApplicationState(){return {neck:false,body:true,back:true};},
  inferAplStationSections(m){return {...m.stationSections};},
  labelSectionForStation(s){return s<=2?"neck":s<=4?"body":"back";},
  buildProgramSummary(){return {rows:[["Center Line Front (deg)",0],["Center Line Back (deg)",180]]};},
  generatedAplSeedProfile(){
    const seed=Array(22).fill(null); seed[1]={plateAngle:0}; seed[11]={plateAngle:-52}; seed[21]={plateAngle:128}; return seed;
  },
  generatedAplMapDrivenProfile(){
    const seed=context.generatedAplSeedProfile();
    const rows=[
      {cmd:3,tableAngle:0,plateAngle:Number(state.buildInputs.plateStartPositionDeg),action:"Zero Line"},
      {cmd:7,tableAngle:0.5,plateAngle:Number(state.buildInputs.plateStartPositionDeg),action:"Hold for Body Application - Agg 3",station:3,section:"body"},
      {cmd:3,tableAngle:147.5,plateAngle:seed[11].plateAngle,action:"Hold for Body Application - Agg 3",station:3,section:"body"}
    ];
    state.motionPlan={rows};
    return rows;
  },
  renderBuildInputs(){},loadSavedSettings(){},
  LabelerBuildInputsController:{updateCalculatedField(id,value){return {id,value};}},
  LabelerWorkspaceActionService:{execute({mutate}){mutate(); return true;}}
};
context.window=context;context.globalThis=context;
context.LabelerAplMapProfileGenerator=Object.freeze({generate:context.generatedAplMapDrivenProfile});
vm.createContext(context);
vm.runInContext(source,context);

const api=context.LabelerFirstApplicationZeroDatum;
assert.equal(api.version,2);
assert.equal(state.buildInputs.plateStartPositionDeg,0);
assert.equal(state.buildInputs.centerLineFrontDeg,0);
const datum=api.resolveApplicationDatum(map,context.generatedAplSeedProfile(),state);
assert.equal(datum.firstStation,3);
assert.equal(datum.firstSection,"body");
assert.equal(datum.rawTargets.body,-52);
assert.equal(datum.offset,0);
assert.equal(datum.rebasedTargets.body,-52);
assert.equal(datum.rebasedTargets.back,128);
assert.equal(datum.firstApplicationZeroRebaseRetired,true);

const rows=context.generatedAplMapDrivenProfile(map);
const app=rows.find(r=>r.cmd===3 && r.station===3);
assert.equal(app.plateAngle,-52);
assert.equal(app.firstPhysicalApplication,true);
assert.equal(state.motionPlan.applicationDatumOffset,0);
assert.equal(state.motionPlan.bodyApplicationTarget,-52);
assert.equal(state.motionPlan.backApplicationTarget,128);
assert.equal(state.motionPlan.firstApplicationZeroRebaseRetired,true);
console.log("first application zero rebase retirement passed");
