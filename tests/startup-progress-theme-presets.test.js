"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

const geometrySource = read("drivers", "geometry", "label-geometry-driver.js");
const themeSource = read("app", "controllers", "theme-presets-controller.js");
const bootstrapSource = read("app", "bootstrap.js");
const appSource = read("app.js");
const startupSource = read("app", "startup-runtime.js");

[
  ["label-geometry-driver.js", geometrySource],
  ["theme-presets-controller.js", themeSource],
  ["bootstrap.js", bootstrapSource],
  ["app.js", appSource],
  ["startup-runtime.js", startupSource]
].forEach(([filename, source]) => {
  assert.doesNotThrow(() => new vm.Script(source, { filename }), `${filename} must parse.`);
});

assert.ok(geometrySource.includes("ServoForgeStartupProgress"));
assert.ok(geometrySource.includes("servoforgeStartupOverlay"));
assert.ok(geometrySource.includes("assets/labeler-tool-icon.svg"));
assert.ok(geometrySource.includes('role="progressbar"'));
assert.ok(geometrySource.includes("Loading core modules"));
assert.ok(geometrySource.includes("function complete"));
assert.ok(geometrySource.includes("function fail"));
assert.ok(geometrySource.includes('body.classList.add("servoforge-initializing")'));
assert.ok(geometrySource.includes('body.classList.remove("servoforge-initializing")'));

[
  "red-black",
  "dark-gold",
  "burnt-orange",
  "forge-gradient"
].forEach((preset) => {
  assert.ok(themeSource.includes(`value: "${preset}"`), `${preset} option must be registered.`);
  assert.ok(themeSource.includes(`body[data-theme="${preset}"]`), `${preset} CSS must be installed.`);
});
assert.ok(themeSource.includes("radial-gradient"));
assert.ok(themeSource.includes("linear-gradient(135deg"));
assert.ok(themeSource.includes("Red & black"));
assert.ok(themeSource.includes("Dark gold"));
assert.ok(themeSource.includes("Burnt orange"));
assert.ok(themeSource.includes("Forge gradient"));

const themePath = "app/controllers/theme-presets-controller.js";
assert.ok(bootstrapSource.includes(themePath));
assert.ok(bootstrapSource.indexOf(themePath) < bootstrapSource.indexOf("app/controllers/settings-controller.js"));
assert.ok(startupSource.includes("LabelerThemePresetsController?.installed"));

[
  "Loading profile engine",
  "Loading geometry and planning",
  "Loading Map Builder",
  "Loading feature integrations",
  "Loading workspace controllers",
  "ServoForge ready"
].forEach((milestone) => assert.ok(appSource.includes(milestone)));
assert.ok(appSource.includes("progress?.complete"));
assert.ok(appSource.includes("progress?.fail"));

[
  "Verifying workspace controllers",
  "Restoring saved settings",
  "Loading company defaults",
  "Preparing machine maps",
  "Applying workspace settings",
  "Rendering ServoForge workspace",
  "Registering update service"
].forEach((milestone) => assert.ok(startupSource.includes(milestone)));
assert.ok(startupSource.includes("return true;"));
assert.ok(startupSource.includes("return false;"));

console.log("Startup progress and expanded theme regression passed.");
