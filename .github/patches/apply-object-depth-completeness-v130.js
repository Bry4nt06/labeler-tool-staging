"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function file(relative) {
  return path.join(root, relative);
}

function read(relative) {
  return fs.readFileSync(file(relative), "utf8");
}

function write(relative, content) {
  fs.writeFileSync(file(relative), content, "utf8");
}

function replaceOnce(relative, before, after) {
  const source = read(relative);
  assert.ok(source.includes(before), `${relative}: expected source block was not found`);
  assert.equal(source.indexOf(before), source.lastIndexOf(before), `${relative}: source block is not unique`);
  write(relative, source.replace(before, after));
}

function replaceCount(relative, before, after, expectedCount) {
  const source = read(relative);
  const count = source.split(before).length - 1;
  assert.equal(count, expectedCount, `${relative}: expected ${expectedCount} matches for ${before}, found ${count}`);
  write(relative, source.split(before).join(after));
}

// Map Builder: expose a complete, explicit depth configuration for every
// user-configurable object family. Existing APL pad/wipe and roller fields stay
// intact; Coding, Sensor, Gripper and Cold Glue Brush receive independent depth.
replaceOnce(
  "index.html",
  `                    <label>Spender depth<input id="spenderDepth" type="number" step="0.1" /></label>\n                    <label>Outside roller depth<input id="opRollerDepth" type="number" step="0.1" /></label>\n                    <label>Inside roller depth<input id="nonOpRollerDepth" type="number" step="0.1" /></label>\n                    <label>Inside wipe depth<input id="wipeInnerDepth" type="number" step="0.1" /></label>\n                    <label>Outside wipe depth<input id="wipeOuterDepth" type="number" step="0.1" /></label>`,
  `                    <label>Spender depth<input id="spenderDepth" type="number" step="0.1" /></label>\n                    <label>Coder / coding depth<input id="codingDepth" type="number" step="0.1" /></label>\n                    <label>Sensor depth<input id="sensorDepth" type="number" step="0.1" /></label>\n                    <label>Gripper depth<input id="gripperDepth" type="number" step="0.1" /></label>\n                    <label>Outside roller depth<input id="opRollerDepth" type="number" step="0.1" /></label>\n                    <label>Inside roller depth<input id="nonOpRollerDepth" type="number" step="0.1" /></label>\n                    <label>Outside pad / wipe depth<input id="wipeOuterDepth" type="number" step="0.1" /></label>\n                    <label>Inside pad / wipe depth<input id="wipeInnerDepth" type="number" step="0.1" /></label>\n                    <label>Outside brush depth<input id="brushOuterDepth" type="number" step="0.1" /></label>\n                    <label>Inside brush depth<input id="brushInnerDepth" type="number" step="0.1" /></label>`
);

// Central defaults preserve the exact visual positions that existed before the
// split: Coding == outside roller, Sensor == outside roller + 7, Gripper ==
// spender, and Brush == pad/wipe depth.
replaceOnce(
  "app/defaults.js",
  `const state = {`,
  `const defaultObjectDepths = Object.freeze({\n  spender: 12,\n  coding: 14,\n  sensor: 21,\n  gripper: 12,\n  opRoller: 14,\n  nonOpRoller: -18,\n  wipeInner: -4,\n  wipeOuter: 16,\n  brushInner: -4,\n  brushOuter: 16\n});\n\nif (typeof window !== "undefined") {\n  window.LabelerDefaultObjectDepths = defaultObjectDepths;\n}\n\nconst state = {`
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

// Upgrade older saved maps without moving any existing equipment. Missing new
// keys are derived from the exact legacy field that previously drove that
// object type, then persisted back into the map on the next normal sync/save.
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

// Renderer: stop borrowing unrelated depth fields. Each object now reads its
// own explicit family depth. APL pads continue to use wipeInner/wipeOuter.
replaceCount(
  "app/assembly-map-renderer.js",
  `state.radius + state.depths.opRoller + 7`,
  `state.radius + state.depths.sensor`,
  2
);
replaceCount(
  "app/assembly-map-renderer.js",
  `state.radius + state.depths.opRoller;`,
  `state.radius + state.depths.coding;`,
  2
);
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

// Cache-bust the staging shell so the newly wired controls and renderer arrive
// together rather than mixing with an older offline shell.
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

const testPath = "tests/object-depth-completeness-v130.test.js";
const testSource = `"use strict";\n\nconst assert = require("node:assert/strict");\nconst fs = require("node:fs");\nconst path = require("node:path");\nconst vm = require("node:vm");\n\nconst root = path.resolve(__dirname, "..");\nconst text = (name) => fs.readFileSync(path.join(root, name), "utf8");\n\nconst index = text("index.html");\nconst defaults = text("app/defaults.js");\nconst setupState = text("app/controllers/setup-state-controller.js");\nconst setupEvents = text("app/controllers/setup-event-controller-integration.js");\nconst runtime = text("app/map-runtime-service.js");\nconst renderer = text("app/assembly-map-renderer.js");\n\nconst depthInputs = {\n  spenderDepth: "spender",\n  codingDepth: "coding",\n  sensorDepth: "sensor",\n  gripperDepth: "gripper",\n  opRollerDepth: "opRoller",\n  nonOpRollerDepth: "nonOpRoller",\n  wipeOuterDepth: "wipeOuter",\n  wipeInnerDepth: "wipeInner",\n  brushOuterDepth: "brushOuter",\n  brushInnerDepth: "brushInner"\n};\n\nObject.entries(depthInputs).forEach(([id, key]) => {\n  assert.match(index, new RegExp(\\`id=[\\\"']\\\${id}[\\\"']\\`), \\`Map Builder must expose \\${id}\\`);\n  assert.match(defaults, new RegExp(\\`\\b\\\${id}:\\\\s*document\\.querySelector\\`), \\`els must bind \\${id}\\`);\n  assert.match(setupState, new RegExp(\\`els\\.\\\${id}[^\\n]*state\\.depths\\?\\.\\\${key}\\`), \\`setup state must sync \\${key}\\`);\n  assert.match(setupEvents, new RegExp(\\`\\b\\\${id}:\\\\s*[\\\"']\\\${key}[\\\"']\\`), \\`change routing must commit \\${key}\\`);\n});\n\n["spender", "coding", "sensor", "gripper", "opRoller", "nonOpRoller", "wipeInner", "wipeOuter", "brushInner", "brushOuter"].forEach((key) => {\n  assert.match(defaults, new RegExp(\\`\\b\\\${key}:\\\\s*-?\\\\d\\`), \\`defaultObjectDepths must define \\${key}\\`);\n});\n\nassert.match(renderer, /state\\.depths\\.sensor/, "sensor must use its own depth");\nassert.match(renderer, /state\\.depths\\.coding/, "coding must use its own depth");\nassert.match(renderer, /state\\.depths\\.gripper/, "gripper must use its own depth");\nassert.match(renderer, /state\\.depths\\.brushOuter/, "outside brush must use its own depth");\nassert.match(renderer, /state\\.depths\\.brushInner/, "inside brush must use its own depth");\nassert.doesNotMatch(renderer, /state\\.depths\\.opRoller\\s*\\+\\s*7/, "sensor must not borrow outside roller depth");\n\nconst context = { console, Object, Number };\ncontext.window = context;\ncontext.globalThis = context;\nvm.createContext(context);\nvm.runInContext(runtime, context, { filename: "map-runtime-service.js" });\n\nconst legacy = context.LabelerMapRuntimeService.completeObjectDepths({\n  spender: 8,\n  opRoller: 3,\n  nonOpRoller: -3,\n  wipeOuter: 16,\n  wipeInner: -16\n});\nassert.equal(legacy.coding, 3, "legacy coder placement must inherit outside roller depth");\nassert.equal(legacy.sensor, 10, "legacy sensor placement must inherit outside roller depth + 7");\nassert.equal(legacy.gripper, 8, "legacy gripper placement must inherit spender depth");\nassert.equal(legacy.brushOuter, 16, "legacy outside brush must inherit outside wipe depth");\nassert.equal(legacy.brushInner, -16, "legacy inside brush must inherit inside wipe depth");\n\nconst explicit = context.LabelerMapRuntimeService.completeObjectDepths({\n  spender: 8, coding: 6, sensor: 12, gripper: 9, opRoller: 3, nonOpRoller: -3,\n  wipeOuter: 16, wipeInner: -16, brushOuter: 18, brushInner: -19\n});\nassert.equal(explicit.coding, 6);\nassert.equal(explicit.sensor, 12);\nassert.equal(explicit.gripper, 9);\nassert.equal(explicit.brushOuter, 18);\nassert.equal(explicit.brushInner, -19);\n\nassert.match(runtime, /map\\.depths\\s*=\\s*\\{\\s*\\.\\.\\.state\\.depths\\s*\\}/, "migrated depths must be written back to the active map");\n\nconsole.log("Object depth completeness v130 regression passed.");\n`;
write(testPath, testSource);

console.log("Applied complete Map Builder object-depth configuration v130.");
