"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cp = require('node:child_process');
const read = path => process.env.TEST_BASELINE
  ? cp.execFileSync('git', ['show', `origin/main:${path}`], {encoding:'utf8'})
  : fs.readFileSync(path,'utf8');
function engine() {
  const context = {state:{maxMoveRatio:9.5,previewAngle:0}, window:{}};
  vm.createContext(context);
  vm.runInContext(read('app/simulation-engine.js'),context);
  return context;
}
test('segments are derived once per frame while plate motion stays identical', () => {
  const c = engine();
  const rows = [{hmi:1,cmd:7,tableAngle:0,plateAngle:0},{hmi:2,cmd:3,tableAngle:20,plateAngle:90},{hmi:3,cmd:0,tableAngle:360,plateAngle:90}];
  let derivations = 0;
  rows.map = (...args) => {derivations++;return Array.prototype.map.apply(rows,args);};
  const expected = Array.from({length:60}, (_,i)=>c.plateAngleAt(i/3, rows));
  derivations = 0;
  assert.equal(typeof c.withProgramSegmentFrame,'function');
  const actual = c.withProgramSegmentFrame(()=>Array.from({length:60},(_,i)=>c.plateAngleAt(i/3,rows)));
  assert.deepEqual(actual,expected);
  assert.equal(derivations,1);
  rows[1].plateAngle = 45;
  assert.equal(c.plateAngleAt(10,rows),22.5);
  c.withProgramSegmentFrame(()=>{
    assert.equal(c.programSegments(rows)[0].moveFault,false);
    c.state.maxMoveRatio = 1;
    assert.equal(c.programSegments(rows)[0].moveFault,true);
  });
  assert.throws(()=>c.withProgramSegmentFrame(()=>{throw new Error('render');}),/render/);
  rows[1].plateAngle = 20;
  assert.equal(c.plateAngleAt(10,rows),10);
});
test('Build Inputs changes the canonical map setting and regenerates/persists it',()=>{
  const map = {machineSettings:{radius:250,coldGlueBrushExitMotion:'shortest'}};
  const state = {applicationMode:'cold-glue'};
  let transaction;
  const c = {state}; c.window = c;
  c.LabelerWorkspaceActionService = {call:name=>name==='editableMachineMap'?map:null,execute:options=>{transaction=options;options.mutate();}};
  vm.createContext(c);vm.runInContext(read('app/controllers/build-inputs-controller.js'),c);
  assert.equal(typeof c.LabelerBuildInputsController.updateColdGlueBrushExitMotion,'function');
  c.LabelerBuildInputsController.updateColdGlueBrushExitMotion('no-reverse');
  assert.equal(map.machineSettings.coldGlueBrushExitMotion,'no-reverse');
  assert.equal(map.machineSettings.radius,250);
  assert.equal(transaction.regenerate,true);assert.equal(transaction.persist,true);
  c.LabelerBuildInputsController.updateColdGlueBrushExitMotion('unknown');
  assert.equal(map.machineSettings.coldGlueBrushExitMotion,'shortest');
  state.applicationMode='apl';
  assert.equal(c.LabelerBuildInputsController.updateColdGlueBrushExitMotion('no-reverse'),false);
  assert.doesNotMatch(read('index.html'),/id="mapColdGlueBrushExitMotion"/);
  assert.match(read('app/build-inputs-renderer.js'),/id="programColdGlueBrushExitMotion"/);
  assert.match(read('app/map-runtime-service.js'),/machineMap.machineSettings = \{\s*\.\.\.machineMap.machineSettings/);
});
test('command boundaries reuse the scene; structural changes and faults still redraw',()=>{
  let redraws=0;
  const c = {state:{headCount:1,previewAngle:20,direction:'ccw',radius:250},num:(v,f)=>Number(v)||f,
    activeSegmentForProgram:()=>({hmi:2}),faultMoves:()=>[],angleToXY:()=>({x:1,y:2}),
    heads:()=>[{head:1,x:1,y:2,tableAngle:20}],bottlePreviewAngle:()=>45,angleToSvgRotation:()=>20};
  c.window=c;vm.createContext(c);vm.runInContext(read('app/map-animation-renderer.js'),c);
  const head={setAttribute(){},querySelectorAll:()=>[]};
  const pocket={setAttribute(){},getAttribute:()=>1};
  const svg={dataset:{animationSegment:'1'},querySelector:()=>null,querySelectorAll:selector=>selector==='[data-animation-head]'?[head]:selector==='[data-animation-pocket]'?[pocket]:[]};
  c.updateAnimatedSvg(svg,[],()=>redraws++);
  assert.equal(redraws,0);assert.equal(svg.dataset.animationSegment,'2');
  c.state.headCount=2;c.updateAnimatedSvg(svg,[],()=>redraws++);assert.equal(redraws,1);
  c.state.headCount=1;c.faultMoves=()=>[{}];svg.dataset.animationSegment='1';
  c.updateAnimatedSvg(svg,[],()=>redraws++);assert.equal(redraws,2);
});
