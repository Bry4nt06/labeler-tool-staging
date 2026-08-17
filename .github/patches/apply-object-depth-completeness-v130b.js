"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const write = (relative, content) => fs.writeFileSync(path.join(root, relative), content, "utf8");

function replaceOnce(relative, before, after) {
  const source = read(relative);
  assert.ok(source.includes(before), `${relative}: expected source block was not found`);
  assert.equal(source.indexOf(before), source.lastIndexOf(before), `${relative}: source block is not unique`);
  write(relative, source.replace(before, after));
}

function replaceCount(relative, before, after, expectedCount) {
  const source = read(relative);
  const count = source.split(before).length - 1;
  assert.equal(count, expectedCount, `${relative}: expected ${expectedCount} matches, found ${count}`);
  write(relative, source.split(before).join(after));
}

replaceOnce(
  "index.html",
  `                    <label>Spender depth<input id="spenderDepth" type="number" step="0.1" /></label>\n                    <label>Outside roller depth<input id="opRollerDepth" type="number" step="0.1" /></label>\n                    <label>Inside roller depth<input id="nonOpRollerDepth" type="number" step="0.1" /></label>\n                    <label>Inside wipe depth<input id="wipeInnerDepth" type="number" step="0.1" /></label>\n                    <label>Outside wipe depth<input id="wipeOuterDepth" type="number" step="0.1" /></label>`,
  `                    <label>Spender depth<input id="spenderDepth" type="number" step="0.1" /></label>\n                    <label>Coder / coding depth<input id="codingDepth" type="number" step="0.1" /></label>\n                    <label>Sensor depth<input id="sensorDepth" type="number" step="0.1" /></label>\n                    <label>Gripper depth<input id="gripperDepth" type="number" step="0.1" /></label>\n                    <label>Outside roller depth<input id="opRollerDepth" type="number" step="0.1" /></label>\n                    <label>Inside roller depth<input id="nonOpRollerDepth" type="number" step="0.1" /></label>\n                    <label>Outside pad / wipe depth<input id="wipeOuterDepth" type="number" step="0.1" /></label>\n                    <label>Inside pad / wipe depth<input id="wipeInnerDepth" type="number" step="0.1" /></label>\n                    <label>Outside brush depth<input id="brushOuterDepth" type="number" step="0.1" /></label>\n                    <label>Inside brush depth<input id="brushInnerDepth" type="number" step="0.1" /></label>`
);

replaceOnce(
  "app/defaults.js",
  `const state = {`,
  `const defaultObjectDepths = Object.freeze({\n  spender: 12,\n  coding: 14,\n  sensor: 21,\n  gripper: 12,\n  opRoller: 14,\n  nonOpRoller: -18,\n  wipeInner: -4,\n  wipeOuter: 16,\n  brushInner: -4,\n  brushOuter: 16\n});\n\nif (typeof window !== "undefined") window.LabelerDefaultObjectDepths = defaultObjectDepths;\n\nconst state = {`
);
replaceOnce(
  "app/defaults.js",
  `  depths: {\n    spender: 12,\n    opRoller: 14,\n    nonOpRoller: -18,\n    wipeInner: -4,\n    wipeOuter: 16\n  },`,
  `  depths: { ...defaultObjectDepths },`
);
replaceOnce(
  "app/defaults.js",
  `  spenderDepth: document.querySelector("#spenderDepth"),\n  opRollerDepth: document.querySelector("#opRollerDepth"),\n  nonOpRollerDepth: document.querySelector("#nonOpRollerDepth"),\n  wipeInnerDepth: document.querySelector("#wipeInnerDepth"),\n  wipeOuterDepth: document.querySelector("#wipeOuterDepth"),`,
  `  spenderDepth: document.querySelector("#spenderDepth"),\n  codingDepth: document.querySelector("#codingDepth"),\n  sensorDepth: document.querySelector("#sensorDepth"),\n  gripperDepth: document.querySelector("#gripperDepth"),\n  opRollerDepth: document.querySelector("#opRollerDepth"),\n  nonOpRollerDepth: document.querySelector("#nonOpRollerDepth"),\n  wipeInnerDepth: document.querySelector("#wipeInnerDepth"),\n  wipeOuterDepth: document.querySelector("#wipeOuterDepth"),\n  brushInnerDepth: document.querySelector("#brushInnerDepth"),\n  brushOuterDepth: document.querySelector("#brushOuterDepth"),`
);

replaceOnce(
  "app/controllers/setup-state-controller.js",
  `    setValue(els.spenderDepth, state.depths?.spender);\n    setValue(els.opRollerDepth, state.depths?.opRoller);\n    setValue(els.nonOpRollerDepth, state.depths?.nonOpRoller);\n    setValue(els.wipeInnerDepth, state.depths?.wipeInner);\n    setValue(els.wipeOuterDepth, state.depths?.wipeOuter);`,
  `    setValue(els.spenderDepth, state.depths?.spender);\n    setValue(els.codingDepth, state.depths?.coding);\n    setValue(els.sensorDepth, state.depths?.sensor);\n    setValue(els.gripperDepth, state.depths?.gripper);\n    setValue(els.opRollerDepth, state.depths?.opRoller);\n    setValue(els.nonOpRollerDepth, state.depths?.nonOpRoller);\n    setValue(els.wipeInnerDepth, state.depths?.wipeInner);\n    setValue(els.wipeOuterDepth, state.depths?.wipeOuter);\n    setValue(els.brushInnerDepth, state.depths?.brushInner);\n    setValue(els.brushOuterDepth, state.depths?.brushOuter);`
);

replaceOnce(
  "app/controllers/setup-event-controller-integration.js",
  `  const depthKeys = Object.freeze({\n    spenderDepth: "spender",\n    opRollerDepth: "opRoller",\n    nonOpRollerDepth: "nonOpRoller",\n    wipeInnerDepth: "wipeInner",\n    wipeOuterDepth: "wipeOuter"\n  });`,
  `  const depthKeys = Object.freeze({\n    spenderDepth: "spender",\n    codingDepth: "coding",\n    sensorDepth: "sensor",\n    gripperDepth: "gripper",\n    opRollerDepth: "opRoller",\n    nonOpRollerDepth: "nonOpRoller",\n    wipeInnerDepth: "wipeInner",\n    wipeOuterDepth: "wipeOuter",\n    brushInnerDepth: "brushInner",\n    brushOuterDepth: "brushOuter"\n  });`
);

replaceOnce(
  "app/map-runtime-service.js",
  `  function invalidateRuntimeMap() {\n    runtimeMapId = null;\n  }`,
  `  function invalidateRuntimeMap() {\n    runtimeMapId = null;\n  }\n\n  function completeObjectDepths(rawDepths = {}) {\n    const defaults = global.LabelerDefaultObjectDepths || {\n      spender: 12, coding: 14, sensor: 21, gripper: 12,\n      opRoller: 14, nonOpRoller: -18, wipeInner: -4, wipeOuter: 16,\n      brushInner: -4, brushOuter: 16\n    };\n    const source = rawDepths && typeof rawDepths === "object" ? rawDepths : {};\n    const finite = (value, fallback) => {\n      const parsed = Number(value);\n      return Number.isFinite(parsed) ? parsed : fallback;\n    };\n    const spender = finite(source.spender, defaults.spender);\n    const opRoller = finite(source.opRoller, defaults.opRoller);\n    const nonOpRoller = finite(source.nonOpRoller, defaults.nonOpRoller);\n    const wipeInner = finite(source.wipeInner, defaults.wipeInner);\n    const wipeOuter = finite(source.wipeOuter, defaults.wipeOuter);\n    return {\n      ...defaults,\n      ...source,\n      spender,\n      coding: finite(source.coding, opRoller),\n      sensor: finite(source.sensor, opRoller + 7),\n      gripper: finite(source.gripper, spender),\n      opRoller,\n      nonOpRoller,\n      wipeInner,\n      wipeOuter,\n      brushInner: finite(source.brushInner, wipeInner),\n      brushOuter: finite(source.brushOuter, wipeOuter)\n    };\n  }`
);
replaceOnce(
  "app/map-runtime-service.js",
  `    state.depths = { ...state.depths, ...map.depths };`,
  `    state.depths = completeObjectDepths(map.depths);\n    map.depths = { ...state.depths };`
);
replaceOnce(
  "app/map-runtime-service.js",
  `    Object.entries({\n      spenderDepth: "spender",\n      opRollerDepth: "opRoller",\n      nonOpRollerDepth: "nonOpRoller",\n      wipeInnerDepth: "wipeInner",\n      wipeOuterDepth: "wipeOuter"\n    }).forEach(([elementKey, depthKey]) => {`,
  `    Object.entries({\n      spenderDepth: "spender",\n      codingDepth: "coding",\n      sensorDepth: "sensor",\n      gripperDepth: "gripper",\n      opRollerDepth: "opRoller",\n      nonOpRollerDepth: "nonOpRoller",\n      wipeInnerDepth: "wipeInner",\n      wipeOuterDepth: "wipeOuter",\n      brushInnerDepth: "brushInner",\n      brushOuterDepth: "brushOuter"\n    }).forEach(([elementKey, depthKey]) => {`
);
replaceOnce(
  "app/map-runtime-service.js",
  `  global.activeMachineMap = activeMachineMap;`,
  `  global.completeObjectDepths = completeObjectDepths;\n  global.activeMachineMap = activeMachineMap;`
);
replaceOnce(
  "app/map-runtime-service.js",
  `    currentMapId,\n    invalidateRuntimeMap,\n    activeMachineMap,`,
  `    currentMapId,\n    invalidateRuntimeMap,\n    completeObjectDepths,\n    activeMachineMap,`
);

replaceCount("app/assembly-map-renderer.js", "state.radius + state.depths.opRoller + 7", "state.radius + state.depths.sensor", 2);
replaceCount("app/assembly-map-renderer.js", "state.radius + state.depths.opRoller;", "state.radius + state.depths.coding;", 2);
replaceOnce(
  "app/assembly-map-renderer.js",
  `        const xy = angleToXY(angle, state.radius + state.depths.spender);\n        const rotation = angleToSvgRotation(angle) + 90;`,
  `        const xy = angleToXY(angle, state.radius + state.depths.gripper);\n        const rotation = angleToSvgRotation(angle) + 90;`
);
replaceOnce(
  "app/assembly-map-renderer.js",
  `        drawMapObjectLabel(add, objectLayer, item, angle, state.radius + state.depths.spender, 18);`,
  `        drawMapObjectLabel(add, objectLayer, item, angle, state.radius + state.depths.gripper, 18);`
);
replaceOnce(
  "app/assembly-map-renderer.js",
  `        const outerRadius = state.radius + state.depths.wipeOuter;\n        const innerRadius = state.radius + state.depths.wipeInner;`,
  `        const outerRadius = state.radius + state.depths.brushOuter;\n        const innerRadius = state.radius + state.depths.brushInner;`
);
replaceOnce(
  "app/assembly-map-renderer.js",
  `      const depth = item.side === "inner" ? state.depths.wipeInner : state.depths.wipeOuter;\n      const brushCenterRadius = state.radius + depth;`,
  `      const depth = item.side === "inner" ? state.depths.brushInner : state.depths.brushOuter;\n      const brushCenterRadius = state.radius + depth;`
);

replaceOnce(
  "app.js",
  `const build = "bottle-orientation-wipe-direction-v127-20260816-0935";`,
  `const build = "object-depth-completeness-v130-20260816-2130";`
);
replaceOnce(
  "service-worker.js",
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-bottle-orientation-wipe-direction-v127-20260816-0935";`,
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-object-depth-completeness-v130-20260816-2130";`
);

console.log("Applied complete Map Builder object-depth configuration v130.");
