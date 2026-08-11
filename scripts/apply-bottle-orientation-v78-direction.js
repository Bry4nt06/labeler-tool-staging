"use strict";

const fs = require("fs");

// First apply the v77 visual refinements (reference bottle profile, cylindrical
// label projection, main animation synchronization, and leading-edge body/back
// wipe presentation) against the current v76 staging source.
require("./apply-bottle-orientation-v77.js");

const PREVIOUS_BUILD = "reference-bottle-wrap-sync-v77-20260811-1748";
const BUILD = "machine-direction-bottle-orientation-v78-20260811-1806";
const UPDATED = "Aug 11, 2026 6:06 PM ET";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing ${label}`);
  return content.replace(from, to);
}

let source = read("app/bottle-orientation-panel-integration.js");

source = replaceRequired(
  source,
  `  function labelArcModel(context) {\n    const { section, plateAngle, geometry, coverage } = context;\n    const center = (section === "back" ? 180 : 0) + plateAngle;`,
  `  function machineVisualAngle(angleDeg) {\n    const angle = finite(angleDeg, 0);\n    return String(runtimeState()?.direction || "cw").toLowerCase() === "cw" ? -angle : angle;\n  }\n\n  function labelArcModel(context) {\n    const { section, plateAngle, geometry, coverage } = context;\n    const visualPlateAngle = machineVisualAngle(plateAngle);\n    const baseCenter = section === "back" ? machineVisualAngle(180) : 0;\n    const center = baseCenter + visualPlateAngle;`,
  "machine-direction angle transform"
);

source = replaceRequired(
  source,
  `    const model = labelArcModel(context);\n    const front = polarPoint(plateAngle, bodyRadius - 5);`,
  `    const model = labelArcModel(context);\n    const visualPlateAngle = machineVisualAngle(plateAngle);\n    const front = polarPoint(visualPlateAngle, bodyRadius - 5);`,
  "top-view bottle direction"
);

source = replaceRequired(
  source,
  `        const inner = polarPoint(degree, 83, 0, 4);\n        const outer = polarPoint(degree, 94, 0, 4);\n        const text = polarPoint(degree, 108, 0, 4);`,
  `        const markerAngle = machineVisualAngle(degree);\n        const inner = polarPoint(markerAngle, 83, 0, 4);\n        const outer = polarPoint(markerAngle, 94, 0, 4);\n        const text = polarPoint(markerAngle, 108, 0, 4);`,
  "machine-direction degree markers"
);

source = replaceRequired(
  source,
  `    const model = labelArcModel(context);\n    const labelY = section === "neck" ? 70 : 128;`,
  `    const model = labelArcModel(context);\n    const visualPlateAngle = machineVisualAngle(plateAngle);\n    const labelY = section === "neck" ? 70 : 128;`,
  "side-view visual plate angle"
);

source = replaceRequired(
  source,
  `    const centerlineX = cx + Math.sin(plateAngle * Math.PI / 180) * bodyHalf * .74;`,
  `    const centerlineX = cx + Math.sin(visualPlateAngle * Math.PI / 180) * bodyHalf * .74;`,
  "side-view centerline direction"
);

source = replaceRequired(
  source,
  `    mainAnimationSyncV77: true\n`,
  `    mainAnimationSyncV77: true,\n    machineDirectionVisualV78: true,\n    directionAwareDegreeMarkersV78: true\n`
);

source = replaceRequired(
  source,
  `    contextFor,\n    topViewSvg,`,
  `    contextFor,\n    machineVisualAngle,\n    topViewSvg,`,
  "machine visual angle export"
);

write("app/bottle-orientation-panel-integration.js", source);

for (const path of [
  "app/bootstrap.js",
  "app/update-manager.js",
  "service-worker.js",
  "index.html",
  "tests/bottle-orientation-panel.test.js",
  "tests/map-workspace-bottle-visual-v75.test.js",
  "tests/entry-exit-dead-zone-overlay.test.js"
]) {
  let content = read(path);
  content = content.split(PREVIOUS_BUILD).join(BUILD);
  write(path, content);
}

let bootstrap = read("app/bootstrap.js");
bootstrap = bootstrap.replace(/const buildUpdatedAt = "[^"]+";/, `const buildUpdatedAt = "${UPDATED}";`);
bootstrap = bootstrap.replace(
  `// Regression lineage: ${PREVIOUS_BUILD} •`,
  `// Regression lineage: ${BUILD} • ${PREVIOUS_BUILD} •`
);
write("app/bootstrap.js", bootstrap);

const manifestPath = "update-manifest.json";
const manifest = JSON.parse(read(manifestPath));
manifest.buildId = BUILD;
manifest.notes = "Staging v78 refines Bottle Orientation to the requested clear long-neck bottle profile, keeps labels cylindrically wrapped to the bottle while it rotates, synchronizes the orientation panel with the main labeler animation, shows Body/Back wipe-down from the leading edge, and makes both bottle rotation and degree markers follow the configured machine direction (CW or CCW).";
write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

let test = read("tests/bottle-orientation-panel.test.js");
test = test.replace("assert.match(source, /Clear glass bottle side view/);", "assert.match(source, /Reference-style clear glass bottle side view/);");
test = test.replace("assert.match(source, /stop-color=\\\"#dbe8ef\\\"/);", "assert.match(source, /stop-color=\\\"#dce9ef\\\"/);");
test = test.replace("assert.match(source, /stop-opacity=\\\"\\.18\\\"/);", "assert.match(source, /stop-opacity=\\\"\\.25\\\"/);");
test = test.replace("assert.match(source, /neckBase\\+1/);", "assert.match(source, /neckBase\\+3/);");
test = replaceRequired(
  test,
  `assert.match(source, /mainAnimationSyncV77: true/);`,
  `assert.match(source, /mainAnimationSyncV77: true/);\nassert.match(source, /machineDirectionVisualV78: true/);\nassert.match(source, /directionAwareDegreeMarkersV78: true/);\nassert.match(source, /function machineVisualAngle/);\nassert.match(source, /runtimeState\\(\\)\\?\\.direction/);\nassert.match(source, /markerAngle = machineVisualAngle\\(degree\\)/);\nassert.match(source, /visualPlateAngle = machineVisualAngle\\(plateAngle\\)/);`,
  "v78 direction regression assertions"
);
test = test.replace("Reference bottle wrap + animation sync v77 regression passed.", "Machine-direction bottle orientation v78 regression passed.");
write("tests/bottle-orientation-panel.test.js", test);

console.log(`Applied ${BUILD}`);
