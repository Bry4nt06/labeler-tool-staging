"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const base=require("../app/troubleshooting/diagnostic-library.js");
const live=require("../app/troubleshooting/topmodul-live-diagnostics.js")(base);
const data=require("../app/troubleshooting/topmodul-plc-fault-data.js");
const library=require("../app/troubleshooting/topmodul-plc-fault-catalog.js")(live,data);

test("TopModul PLC catalog indexes all named Faults_LB1 alarms",()=>{
  assert.equal(library.topModulNamedFaultCount,513);
  assert.equal(library.validate().ok,true,library.validate().errors.join("\n"));
  assert.equal(library.sources.some(s=>s.id==="topmodul-k407039-lb1-l5k"),true);
  assert.equal(library.sources.some(s=>s.id==="topmodul-k407039-electrical"),true);
  assert.equal(library.sources.some(s=>s.id==="topmodul-k605163-apl-electrical"),true);
});

test("exact TopModul PLC fault number opens its PLC bit and family",()=>{
  const fault=library.searchEntries("1091",{machineType:"TopModul"},3)[0];
  assert.equal(fault.code,"1091");
  assert.equal(fault.title,"Labeling Station 1 / Labeler Encoder / Feedback Fault");
  assert.equal(fault.plcFault.address,"Faults_LB1[68].3");
  assert.equal(fault.plcFault.station,1);
  assert.equal(fault.plcFault.family,"Labeler encoder / feedback");
});

test("repeated encoder feedback faults preserve station-specific PLC anchors",()=>{
  const expected=[[1091,"Faults_LB1[68].3",1],[1171,"Faults_LB1[73].3",2],[1251,"Faults_LB1[78].3",3],[1331,"Faults_LB1[83].3",4],[1411,"Faults_LB1[88].3",5],[1491,"Faults_LB1[93].3",6]];
  for(const [number,address,station] of expected){const fault=library.getTopModulFault(number);assert.equal(fault?.plcFault.address,address);assert.equal(fault?.plcFault.station,station);assert.equal(fault?.plcFault.family,"Labeler encoder / feedback");}
});

test("main-machine fine clock and servo bottle table faults bind to known PLC bits",()=>{
  assert.equal(library.getTopModulFault(670)?.plcFault.address,"Faults_LB1[41].14");
  assert.equal(library.getTopModulFault(670)?.title,"Safety Circuit Fault Fine Clock Pulse Monitoring");
  assert.equal(library.getTopModulFault(524)?.title,"Servo Bottle Table / Encoder Continuity");
  assert.equal(library.getTopModulFault(524)?.plcFault.address,"Faults_LB1[32].12");
});

test("field-observed 00067 remains separate from PLC Fault 067",()=>{
  const field=library.searchEntries("00067",{machineType:"TopModul"},3)[0];
  assert.equal(field.id,"topmodul-00067-labeler-encoder-feedback");
  const plc=library.searchEntries("067",{machineType:"TopModul"},3)[0];
  assert.equal(plc.id,"topmodul-plc-fault-67");
  assert.equal(plc.title,"Labeling Station Change Mode Active");
});

test("browser page loads TopModul data and catalog before troubleshooting controller",()=>{
  const html=fs.readFileSync(path.join(__dirname,"../app/troubleshooting/index.html"),"utf8");
  const dataPos=html.indexOf("topmodul-plc-fault-data.js");
  const catalogPos=html.indexOf("topmodul-plc-fault-catalog.js");
  const appPos=html.indexOf("troubleshooting-app.js");
  assert.ok(dataPos>0&&catalogPos>dataPos&&appPos>catalogPos);
});
