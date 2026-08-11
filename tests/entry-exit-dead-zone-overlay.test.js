"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
global.window = global;
global.state = { radius: 250, showEntryExitDeadZoneOverlay: false, showMoveDistanceOverlay: false, showAllProgramMovesOverlay: false };
global.angleToXY = (angle, radius) => { const r = Number(angle) * Math.PI / 180; return { x: Math.cos(r) * radius, y: Math.sin(r) * radius }; };
global.fmt = (value) => String(value);
const overlayPath = path.join(root, "app/map-overlay-renderer.js");
delete require.cache[require.resolve(overlayPath)];
require(overlayPath);
assert.deepStrictEqual(global.LabelerMapOverlayRenderer.entryExitDeadZone, { start: 330, end: 30, span: 60 });
function collect() { const nodes = []; const add = (name, attrs) => { const node = { name, attrs, textContent: "" }; nodes.push(node); return node; }; global.drawEntryExitDeadZoneOverlay(add, {}); return nodes; }
assert.equal(collect().length, 0);
state.showEntryExitDeadZoneOverlay = true;
let nodes = collect();
assert(nodes.some((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30"));
assert.deepStrictEqual(nodes.filter((n) => n.attrs["data-dead-zone-boundary"] !== undefined).map((n) => Number(n.attrs["data-dead-zone-boundary"])), [330, 30]);
state.showMoveDistanceOverlay = true; state.showAllProgramMovesOverlay = true;
nodes = collect();
assert(nodes.some((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30"), "dead zone must remain active with other overlays");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(index, /id="showEntryExitDeadZoneOverlay"/); assert.match(index, /330° → 30°/); assert.match(index, /entry-exit-dead-zone-overlay-v73-20260811-1604/);
const settings = fs.readFileSync(path.join(root, "app/controllers/settings-controller.js"), "utf8");
assert.match(settings, /function setEntryExitDeadZoneOverlay/); assert.match(settings, /commit\("showEntryExitDeadZoneOverlay"/);
for (const relative of ["app/mechanical-map-scene-renderer.js", "app/simulation-map-scene-renderer.js"]) { const source = fs.readFileSync(path.join(root, relative), "utf8"); assert.match(source, /drawEntryExitDeadZoneOverlay\(add, deadZoneLayer\)/); assert(source.indexOf("drawEntryExitDeadZoneOverlay(add, deadZoneLayer)") < source.indexOf("drawMoveDistanceOverlay")); }
console.log("Entry / exit dead zone overlay v73 regression passed.");
