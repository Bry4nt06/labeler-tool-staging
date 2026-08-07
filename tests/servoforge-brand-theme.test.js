"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const integration = read("app/servoforge-brand-theme-integration.js");
const bootstrap = read("app/bootstrap.js");
const mark = read("assets/labeler-tool-icon.svg");

assert.doesNotThrow(() => new vm.Script(integration, { filename: "servoforge-brand-theme-integration.js" }));
assert.doesNotThrow(() => new vm.Script(bootstrap, { filename: "bootstrap.js" }));

assert.match(integration, /THEME_VALUE = "servoforge"/);
assert.match(integration, /THEME_LABEL = "ServoForge"/);
assert.match(integration, /servoforge-brand-lockup/);
assert.match(integration, /servoforge-brand-mark/);
assert.match(integration, /SERVOFORGE/);

const requiredPalette = [
  "#0A0F14",
  "#111820",
  "#1A222C",
  "#232E3A",
  "#FF4D2E",
  "#FF8A00",
  "#2D6BFF",
  "#00D4FF",
  "#2ECC71",
  "#E6ECF2",
  "#9AA7B3",
  "#5E6B78",
  "#26313D"
];
requiredPalette.forEach((hex) => {
  assert.ok(integration.toUpperCase().includes(hex), `ServoForge theme must retain ${hex}.`);
});

assert.match(mark, /aria-label="ServoForge"/);
assert.match(mark, /servoforgeMarkGradient/);
assert.match(mark, /#ff4d2e/i);
assert.match(mark, /#ff8a00/i);
assert.match(mark, /filter="url\(#servoforgeGlow\)"/);

assert.match(bootstrap, /app\/servoforge-brand-theme-integration\.js/);
assert.match(bootstrap, /servoforge-brand-theme-20260807-1024/);
assert.match(bootstrap, /Aug 7, 2026 10:24 AM ET/);

console.log("ServoForge brand mark and selectable theme regression passed.");
