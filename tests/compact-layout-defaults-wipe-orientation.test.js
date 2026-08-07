"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const integrationSource = fs.readFileSync(path.join(root, "app", "compact-layout-defaults-wipe-orientation-integration.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const companyDefaults = JSON.parse(fs.readFileSync(path.join(root, "config", "company-default-settings.json"), "utf8"));

assert.doesNotThrow(() => new vm.Script(integrationSource, { filename: "compact-layout-defaults-wipe-orientation-integration.js" }));
assert.match(bootstrapSource, /compact-layout-defaults-pad-orientation-v36-20260807-1545/);
assert.match(bootstrapSource, /app\/compact-layout-defaults-wipe-orientation-integration\.js/);
assert.equal(companyDefaults.settings.themePreset, "servoforge");
assert.equal(companyDefaults.settings.showAllProgramMovesOverlay, true);

assert.match(integrationSource, /DEFAULT_CAP_FILL = "#671018"/);
assert.match(integrationSource, /#labelSpecs \.label-specs-table[\s\S]*min-width: 0 !important/);
assert.match(integrationSource, /#buildInputs \.build-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
assert.match(integrationSource, /data-bevel-facing": "against-machine-direction"/);
assert.match(integrationSource, /data-pad-facing/);
assert.match(integrationSource, /radially-outward-to-bottle/);

const storage = new Map([
  ["labelerToolSettings", JSON.stringify({
    themePreset: "graphite",
    showAllProgramMovesOverlay: false,
    showMoveDistanceOverlay: true
  })]
]);
const appendedStyles = [];
const context = {
  console,
  state: {
    themePreset: "graphite",
    showAllProgramMovesOverlay: false,
    showMoveDistanceOverlay: true,
    referencePitchRadiusMm: 572.958,
    tablePitchRadiusMm: 572.958,
    radius: 250,
    direction: "ccw"
  },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  document: {
    getElementById() { return null; },
    createElement(tag) { return { tagName: tag, id: "", textContent: "" }; },
    head: { appendChild(node) { appendedStyles.push(node); } }
  },
  angleToXY(angle, radius) {
    const radians = Number(angle) * Math.PI / 180;
    return { x: Math.cos(radians) * Number(radius), y: Math.sin(radians) * Number(radius) };
  },
  arcPath(start, end, inner, outer) {
    return `arc:${start}:${end}:${inner}:${outer}`;
  },
  drawSpongeWipeDownPad() {},
  LabelerWipeComponentVisualRenderer: Object.freeze({ spongeWipePadsV2: true })
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(integrationSource, context, { filename: "compact-layout-defaults-wipe-orientation-integration.js" });

assert.equal(context.ServoForgeCompactLayoutDefaults.installed, true);
assert.equal(context.state.showAllProgramMovesOverlay, true, "Existing staging sessions are migrated once to the new overlay default.");
assert.equal(context.state.showMoveDistanceOverlay, false);
assert.equal(JSON.parse(storage.get("labelerToolSettings")).showAllProgramMovesOverlay, true);
assert.equal(storage.get("servoforge-show-all-program-moves-default-v1"), "true");
assert.equal(context.state.themePreset, "graphite", "An explicit user theme remains user-owned.");
assert.equal(appendedStyles.length, 1);
assert.match(appendedStyles[0].textContent, /#671018/);

const outerPath = context.ServoForgeCompactLayoutDefaults.sideAwareTrailingPadPath(100, 120, 266, 10, "outer");
const innerPath = context.ServoForgeCompactLayoutDefaults.sideAwareTrailingPadPath(100, 120, 246, 10, "inner");
assert.notEqual(innerPath, outerPath, "Inside pad geometry must be radially mirrored rather than reusing the outside bevel slope.");
assert.equal(context.LabelerWipeComponentVisualRenderer.innerPadFacesBottleV1, true);
assert.equal(context.LabelerWipeComponentVisualRenderer.bevelAgainstMachineDirectionV2, true);

console.log("Compact layout, default settings, bottle center, and wipe orientation regression passed.");
