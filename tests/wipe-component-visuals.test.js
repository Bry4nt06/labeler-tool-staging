"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.resolve(__dirname,".."),read=r=>fs.readFileSync(path.join(root,r),"utf8");
const a=read("app/assembly-map-renderer.js"),m=read("app/mechanical-map-scene-renderer.js"),s=read("app/simulation-map-scene-renderer.js"),c=read("app/inside-wipe-mounting-correction-integration.js"),b=read("app/bootstrap.js");
assert.doesNotThrow(()=>new vm.Script(a));
assert.doesNotThrow(()=>new vm.Script(c));
assert.match(a,/WIPE_DOWN_PAD_WIDTH_MM = 22/);
assert.match(a,/servoforge-wipe-sponge-pattern/);
assert.match(a,/function machineTrailingPadPath/);
assert.match(a,/innerTrailingStart = start \+ bevelDeg/);
assert.match(a,/const d = machineTrailingPadPath/);
assert.match(a,/against-machine-direction/);
assert.doesNotMatch(a,/function machineForwardPadPath/);
assert.doesNotMatch(a,/"data-bevel-facing": "machine-forward"/);
assert.match(a,/servoforge-roller-sponge-pattern/);
assert.match(a,/data-roller-hub/);
assert.match(m,/drawSpongeRoller\(add, equipmentLayer/);
assert.match(s,/drawConfiguredAssemblies\(add, configuredAssemblyLayer\)/);

// Physical inside-wipe mounting reference: the inside pad is radially flipped
// compared with the outside pad. The long edge stays toward table center and
// the short/beveled edge faces the bottle path, while the tangential bevel end
// remains unchanged.
assert.match(c,/outerStartAngle = isInner \? start \+ bevelDeg : start/);
assert.match(c,/innerStartAngle = isInner \? start : start \+ bevelDeg/);
assert.match(c,/data-long-edge-facing/);
assert.match(c,/machine-center/);
assert.match(c,/data-inside-wipe-mount/);
assert.match(c,/long-edge-center-short-bevel-bottle/);
assert.match(c,/innerPadYellowSketchMountV1: true/);
assert.match(c,/MAX_RETRIES = 200/);

const compactIndex=b.indexOf("app/compact-layout-defaults-wipe-orientation-integration.js");
const mountingIndex=b.indexOf("app/inside-wipe-mounting-correction-integration.js");
assert.ok(compactIndex>=0 && mountingIndex>compactIndex,"Inside-wipe mounting correction must load after the compact/default orientation layer.");

console.log("Authoritative reverse-bevel sponge wipe, roller visual, and inside mounting regression passed.");
