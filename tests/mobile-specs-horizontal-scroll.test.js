"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const uiSource = fs.readFileSync(path.join(root, "app", "controllers", "specification-table-ui-controller.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(uiSource), "Specs UI controller must parse.");
assert.match(uiSource, /@media \(max-width: 760px\)/);
assert.match(uiSource, /#specs\.table-wrap\s*\{[\s\S]*?overflow:\s*visible/);
assert.match(uiSource, /#specs #bottleSpecs,[\s\S]*?#specs #labelSpecs\s*\{[\s\S]*?overflow-x:\s*auto/);
assert.match(uiSource, /-webkit-overflow-scrolling:\s*touch/);
assert.match(uiSource, /overscroll-behavior-x:\s*contain/);
assert.match(uiSource, /touch-action:\s*pan-x pan-y/);
assert.match(uiSource, /#specs #bottleSpecs > table,[\s\S]*?#specs #labelSpecs > table\s*\{[\s\S]*?max-width:\s*none/);

assert.match(bootstrapSource, /mobile-specs-horizontal-scroll-v45-20260809-0214/);
assert.match(bootstrapSource, /app\/controllers\/specification-table-ui-controller\.js/);

console.log("Mobile Specs horizontal touch-scroll regression passed.");
