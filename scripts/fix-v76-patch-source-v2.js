"use strict";

const fs = require("fs");
const path = "scripts/apply-full-cycle-bottle-orientation-v76.js";
let source = fs.readFileSync(path, "utf8");

const startMarker = 'source = replaceFunction(source, "function sideViewSvg(context) {"';
const endMarker = 'source = source\n  .replaceAll';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error("Unable to locate v76 side-view patch block");

const replacement = 'const SIDE_VIEW_SOURCE = read("scripts/v76-side-view.txt");\nsource = replaceFunction(source, "function sideViewSvg(context) {", "function panelMarkup(source) {", SIDE_VIEW_SOURCE, "realistic clear bottle side view");\n\n';
source = source.slice(0, start) + replacement + source.slice(end);
source = source.replace('assert.match(source, /C \\\\${cx-neckHalf} \\\\${neckBase\\\\+1}/);\\n', 'assert.match(source, /neckBase\\\\+1/);\\n');
fs.writeFileSync(path, source);
console.log("v76 patch now reads the side-view function from a plain text source file.");
