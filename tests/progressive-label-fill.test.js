"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app", "progressive-label-fill-integration.js"), "utf8");
const bootstrapSource = fs.readFileSync(path.join(root, "app", "bootstrap.js"), "utf8");
const featureManifestSource = fs.readFileSync(path.join(root, "app", "simulation-collapsible-integration.js"), "utf8");

assert.doesNotThrow(() => new vm.Script(source, { filename: "progressive-label-fill-integration.js" }));

const sandbox = {
  console,
  state: {
    direction: "ccw",
    applicationMode: "APL",
    buildInputs: {
      neckApplicationReference: "center-tack",
      bodyApplicationReference: "center-tack",
      backApplicationReference: "leading-edge",
      neckContactMm: 0,
      bodyContactMm: 5,
      backContactMm: 5
    }
  },
  LabelerBottleVisualRenderer: {
    indicators: {
      neck: { center: 0, innerRadius: 4.05, outerRadius: 5.15, color: "#ff8a32" },
      body: { center: 0, innerRadius: 6, outerRadius: 7.25, color: "#4ca8ff" },
      back: { center: 180, innerRadius: 6, outerRadius: 7.25, color: "#71d34f" }
    },
    drawTopViewBottle() {}
  },
  LabelerWipeTelemetryService: {
    wipeLabelLengthMm(section) { return section === "body" ? 64.9 : 47.5; },
    wipeObjectsForSection() { return [{}]; },
    contactedLabelCoverage() {
      return { percentage: 25, leftPercent: 40, rightPercent: 60 };
    }
  },
  drawTopViewBottle() {},
  bottleHasPassedApplication(tableAngle, applicationAngle) {
    return Number(tableAngle) >= Number(applicationAngle);
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: "progressive-label-fill-integration.js" });

const feature = sandbox.LabelerProgressiveLabelFill;
assert.equal(feature.progressiveBottleLabelFillV1, true);
assert.equal(feature.leadingEdgeFillV1, true);
assert.equal(feature.centerTackFillV1, true);

assert.equal(feature.wipeApplicationReference("body"), "center-tack");
assert.equal(feature.wipeApplicationReference("back"), "leading-edge");
assert.equal(sandbox.wipeVisualApplication("body", 64.9).tackMode, "center");
assert.equal(sandbox.wipeVisualApplication("back", 47.5).tackMode, "leading");

sandbox.state.buildInputs.bodyApplicationReference = "leading-edge";
assert.equal(feature.wipeApplicationReference("body"), "leading-edge");
assert.equal(sandbox.wipeVisualApplication("body", 64.9).tackMode, "leading");
sandbox.state.buildInputs.bodyApplicationReference = "center-tack";

const leadingLtr = feature.labelProgressWindows({
  applied: true,
  tackMode: "leading",
  direction: "ltr",
  centerDeg: 0,
  arcWidthDeg: 100,
  percentage: 25
});
assert.deepEqual(Array.from(leadingLtr.primary), [-50, -25], "Leading Edge LTR must fill from the applied edge.");

const leadingRtl = feature.labelProgressWindows({
  applied: true,
  tackMode: "leading",
  direction: "rtl",
  centerDeg: 0,
  arcWidthDeg: 100,
  percentage: 25
});
assert.deepEqual(Array.from(leadingRtl.primary), [25, 50], "Leading Edge RTL must fill from the opposite applied edge.");

const centered = feature.labelProgressWindows({
  applied: true,
  tackMode: "center",
  direction: "rtl",
  centerDeg: 0,
  arcWidthDeg: 100,
  leftPercent: 40,
  rightPercent: 60
});
assert.deepEqual(Array.from(centered.left), [-20, 0], "Center Tack left fill must originate at label center.");
assert.deepEqual(Array.from(centered.right), [0, 30], "Center Tack right fill must originate at label center.");

const centerTackStart = feature.labelProgressWindows({
  applied: true,
  tackMode: "center",
  centerDeg: 180,
  arcWidthDeg: 90,
  leftPercent: 0,
  rightPercent: 0
});
assert.ok(centerTackStart.tack[0] < 180 && centerTackStart.tack[1] > 180, "Center Tack must visibly begin at the label midpoint.");

const leadingStart = feature.labelProgressWindows({
  applied: true,
  tackMode: "leading",
  direction: "rtl",
  centerDeg: 0,
  arcWidthDeg: 100,
  percentage: 0
});
assert.ok(leadingStart.tack[0] >= 46 && leadingStart.tack[1] === 50, "Leading Edge must visibly begin at the applied edge.");

const complete = feature.labelProgressWindows({
  applied: true,
  tackMode: "leading",
  direction: "ltr",
  centerDeg: 0,
  arcWidthDeg: 100,
  percentage: 100
});
assert.deepEqual(Array.from(complete.primary), [-50, 50], "Completed Leading Edge fill must cover the complete label footprint.");

assert.ok(source.includes("contactedLabelCoverage"), "Bottle fill must use the physical wipe coverage service.");
assert.ok(source.includes("data-bottle-label-footprint"), "The full label footprint must remain available as a faint base arc.");
assert.ok(source.includes("data-bottle-label-progress"), "Progress arcs must be rendered separately from the full footprint.");
assert.ok(source.includes("updateMapAnimationFrameWithLabelProgress"), "Mechanical Map animation must refresh label fill continuously.");
assert.ok(source.includes("updateSimulationAnimationFrameWithLabelProgress"), "Simulation animation must refresh label fill continuously.");

const dependencyMarkers = [
  "app/wipe-telemetry-service.js",
  "app/bottle-visual-renderer.js",
  "app/mechanical-map-scene-renderer.js",
  "app/simulation-map-scene-renderer.js",
  "app/map-animation-renderer.js"
];
const progressiveMarker = "app/progressive-label-fill-integration.js";
const progressiveIndex = featureManifestSource.indexOf(progressiveMarker);
assert.ok(progressiveIndex >= 0, "Progressive fill must be owned by the ordered feature manifest.");
dependencyMarkers.forEach((marker) => {
  const dependencyIndex = featureManifestSource.indexOf(marker);
  assert.ok(dependencyIndex >= 0, `${marker} must be present in the feature manifest.`);
  assert.ok(dependencyIndex < progressiveIndex, `${marker} must load before progressive label fill.`);
});
assert.equal(
  bootstrapSource.includes(`\"${progressiveMarker}\"`),
  false,
  "Bootstrap must not race-load progressive label fill before renderer dependencies are ready."
);
assert.ok(bootstrapSource.includes("progressive-label-loader-order-v47-20260809-1802"), "The v47 loader-order build marker must be active.");

console.log("Progressive bottle label fill regression passed.");
