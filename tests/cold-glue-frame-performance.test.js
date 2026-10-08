"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const read=path=>process.env.TEST_BASELINE?cp.execFileSync('git',['show',`origin/main:${path}`],{encoding:'utf8'}):fs.readFileSync(path,'utf8');
function builderHarness(){
  const frames=[],records=[],observers=[],listeners={};
  class Element {
    constructor(tag='div',className=''){this.tagName=tag;this.className=className;this.children=[];this.dataset={};this.nodeType=1;this.markup='';}
    contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
    matches(selector){return selector.split(',').some(s=>s.startsWith('.')&&this.className.split(' ').includes(s.slice(1)));}
    closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector);}
    appendChild(node){node.parentElement=this;this.children.push(node);records.push({type:'childList',target:this,addedNodes:[node],removedNodes:[]});return node;}
    prepend(node){this.appendChild(node);}
    insertBefore(node){this.appendChild(node);}
    set textContent(value){this.text=value;records.push({type:'childList',target:this,addedNodes:[{nodeType:3}],removedNodes:[]});}
    get textContent(){return this.text||'';}
    set innerHTML(value){this.markup=value;const removed=this.children;this.children=[];
      if(value.includes('cold-glue-parameter-grid')){const grid=new Element('div','cold-glue-parameter-grid');grid.parentElement=this;this.children.push(grid);}
      records.push({type:'childList',target:this,addedNodes:this.children,removedNodes:removed});}
    get innerHTML(){return this.markup;}
    querySelector(selector){if(selector.includes('data-cold-glue-sequence-param'))return this.children.find(n=>n.markup.includes('data-cold-glue-sequence-param'))||null;
      const matches=n=>selector.includes('data-builder-object-id')?n.dataset.builderObjectId===selector.match(/="([^"]+)"/)?.[1]:selector.includes('cold-glue-parameter-grid')?n.matches('.cold-glue-parameter-grid'):selector.includes('cold-glue-process-parameters')?n.matches('.cold-glue-process-parameters'):selector.includes('cold-glue-gripper-order-badge')?n.matches('.cold-glue-gripper-order-badge'):selector.includes('builder-object-editor')?n.matches('.builder-object-editor'):false;
      for(const child of this.children){if(matches(child))return child;const nested=child.querySelector?.(selector);if(nested)return nested;}return null;}
    querySelectorAll(selector){if(selector.includes('wipe-builder-row'))return this.children.filter(n=>n.matches('.wipe-builder-row'));return [];}
  }
  const list=new Element(),row=new Element('div','wipe-builder-row'),editor=new Element('div','builder-object-editor');row.dataset.builderObjectId='g1';row.appendChild(editor);list.appendChild(row);
  const map={id:'cold-map',applicationMode:'cold-glue',headCount:60,objects:[{id:'g1',kind:'gripper',application:'cold-glue',station:1,angle:90,labelSection:'neck'}]};
  const context={state:{headCount:60},console,CSS:{escape:s=>s},editableMachineMap:()=>map,activeMachineMap:()=>map,generatedColdGlueFixedProfile:()=>[],renderWipeDownBuilder:()=>{},
    document:{readyState:'complete',documentElement:{dataset:{}},head:{appendChild(){}},createElement:tag=>new Element(tag),querySelector:selector=>selector==='#wipeBuilderList'?list:selector.includes('Styles')?{}:null,addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)},
    requestAnimationFrame:fn=>frames.push(fn),setTimeout:fn=>frames.push(fn),MutationObserver:class{constructor(fn){this.fn=fn;}observe(target){observers.push({target,fn:this.fn});}}};
  context.window=context;vm.createContext(context);
  for(const file of ['app/cold-glue-parameter-editor-integration.js','app/cold-glue-gripper-sequence-integration-v2.js'])vm.runInContext(read(file),context);
  function drain(limit=12){let count=0;while(frames.length&&count<limit){const batch=frames.splice(0);batch.forEach(fn=>fn());const mutations=records.splice(0);observers.forEach(o=>{const relevant=mutations.filter(r=>o.target.contains(r.target));if(relevant.length)o.fn(relevant);});count++;}return {count,pending:frames.length};}
  return {context,map,list,row,editor,Element,frames,records,drain,listeners};
}
test('Cold Glue builder decoration settles instead of consuming every animation frame',()=>{
  const h=builderHarness(),result=h.drain();assert.equal(result.pending,0,'Unchanged gripper badges must not retrigger themselves');assert.ok(result.count<=3);
  const section=h.editor.querySelector('.cold-glue-process-parameters');
  assert.match(section.innerHTML,/data-cold-glue-param="brushEntryPlateAngleDeg"/);
  assert.match(section.innerHTML,/Gripper • Station 1/);
  h.context.LabelerColdGlueParameterEditor.refresh();assert.equal(h.drain().count,1,'Explicit unchanged refresh must settle in one pass');
});
test('only replacing builder rows/editors schedules decoration; own controls/text are ignored',()=>{
  const h=builderHarness();h.drain();const api=h.context.LabelerColdGlueParameterEditor;assert.ok(api);
  const own=h.editor.querySelector('.cold-glue-process-parameters');
  assert.equal(api.builderRowsChanged([{type:'childList',target:own,addedNodes:[new h.Element()],removedNodes:[]}]),false);
  assert.equal(api.builderRowsChanged([{type:'childList',target:h.list,addedNodes:[new h.Element('div','wipe-builder-row')],removedNodes:[]}]),true);
  assert.equal(api.builderRowsChanged([{type:'childList',target:h.list,addedNodes:[{nodeType:3}],removedNodes:[]}]),false);
});
test('hidden or collapsed bottle-orientation panels do no live frame work',()=>{
  const source=read('app/bottle-orientation-panel-integration.js');
  const a=source.indexOf('  function renderAll('),b=source.indexOf('  function stopPlayback(',a);
  let renders=0;const state={activeTab:'buildInputs'};
  const c={runtimeState:()=>state,panelHost:()=>({querySelector:()=>({open:true})}),removePanel(){},renderSource(){renders++;},PANEL_ATTR:'data-bottle-orientation-panel'};vm.createContext(c);vm.runInContext(source.slice(a,b),c);
  c.renderAll({visibleOnly:true});assert.equal(renders,0);
  state.activeTab='program';c.renderAll({visibleOnly:true});assert.equal(renders,1);
  c.panelHost=()=>({querySelector:()=>({open:false})});c.renderAll({visibleOnly:true});assert.equal(renders,1);
  c.renderAll();assert.equal(renders,2,'Explicit refresh still updates collapsed panels');
});

test('brush-entry edits use one parameter listener and preserve generation/persistence',()=>{
  const h=builderHarness();h.drain();let generations=0,saves=0;
  h.context.applyGeneratedServoProfile=()=>generations++;h.context.saveCurrentSettings=()=>saves++;
  const control={dataset:{coldGlueParam:'brushEntryPlateAngleDeg'},type:'number',value:'135.5',closest:selector=>selector==='[data-cold-glue-param]'?control:h.row};
  h.listeners.change.forEach(fn=>fn({target:control}));
  assert.equal(h.map.objects[0].brushEntryPlateAngleDeg,135.5);assert.equal(generations,1);assert.equal(saves,1);
  assert.equal(h.drain().pending,0);assert.match(h.editor.querySelector('.cold-glue-process-parameters').innerHTML,/value="135.5"/);
});
