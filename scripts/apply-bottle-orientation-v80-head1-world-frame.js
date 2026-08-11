"use strict";

const fs = require("fs");

const PREVIOUS_BUILD = "machine-bottle-datum-alignment-v79-20260811-1756";
const BUILD = "head1-world-frame-top-view-v80-20260811-1830";
const UPDATED = "Aug 11, 2026 6:30 PM ET";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing ${label}`);
  return content.replace(from, to);
}

let source = read("app/bottle-orientation-panel-integration.js");
source = replaceRequired(source, "  const VERSION = 4;", "  const VERSION = 5;", "bottle orientation version");

source = replaceRequired(
  source,
  `  function machineVisualAngle(angleDeg) {\n    const angle = finite(angleDeg, 0);\n    return String(runtimeState()?.direction || "cw").toLowerCase() === "cw" ? -angle : angle;\n  }`,
  `  function machineVisualAngle(angleDeg) {\n    const angle = finite(angleDeg, 0);\n    return String(runtimeState()?.direction || "cw").toLowerCase() === "cw" ? -angle : angle;\n  }\n\n  function tableFrameVisualAngle(tableAngle) {\n    // Use the exact table/head transform used by the live Mechanical Map.\n    // This makes the Top View a magnified world-frame view of servo/head 1,\n    // rather than a bottle-only compass that ignores where the head is on the table.\n    try {\n      if (typeof angleToSvgRotation === "function") {\n        const mapped = finite(angleToSvgRotation(normalizeAngle(tableAngle)), NaN);\n        if (Number.isFinite(mapped)) return mapped;\n      }\n    } catch {\n      // Mirror geometry-primitives.js below if the shared helper is unavailable.\n    }\n    const current = runtimeState();\n    const direction = String(current?.direction || "cw").toLowerCase();\n    const signed = direction === "cw" ? -1 : 1;\n    const zeroBase = direction === "cw" ? 180 : 0;\n    return normalizeAngle(zeroBase + finite(current?.zeroAngle, 0) + signed * finite(tableAngle, 0));\n  }\n\n  function headOneWorldVisualAngle(tableAngle, plateAngle) {\n    // Mechanical Map parity:\n    // angleToSvgRotation(head.tableAngle) + servoSign * bottlePreviewAngle(head)\n    return tableFrameVisualAngle(tableAngle) + machineVisualAngle(plateAngle);\n  }`,
  "head 1 mechanical-map transform helpers"
);

source = replaceRequired(
  source,
  `    const model = labelArcModel(context);\n    const visualPlateAngle = machineVisualAngle(plateAngle);\n    const front = polarPoint(visualPlateAngle, bodyRadius - 5);\n    const labelCenterPoint = polarPoint(model.center, labelRadius - 5);`,
  `    const localModel = labelArcModel(context);\n    const tableFrameAngle = tableFrameVisualAngle(context.tableAngle);\n    // Rotate the complete bottle-local label model into the same world frame as\n    // servo/head 1 on the Mechanical Map. Local servo rotation remains layered\n    // on top through labelArcModel(), exactly like the live bottle-table group.\n    const model = {\n      ...localModel,\n      center: localModel.center + tableFrameAngle,\n      start: localModel.start + tableFrameAngle,\n      end: localModel.end + tableFrameAngle,\n      leadingEdge: localModel.leadingEdge + tableFrameAngle,\n      wipeRanges: localModel.wipeRanges.map(([start, end]) => [start + tableFrameAngle, end + tableFrameAngle])\n    };\n    const visualPlateAngle = headOneWorldVisualAngle(context.tableAngle, plateAngle);\n    const front = polarPoint(visualPlateAngle, bodyRadius - 5);\n    const labelCenterPoint = polarPoint(model.center, labelRadius - 5);`,
  "top-view head 1 world-frame model"
);

source = replaceRequired(
  source,
  `        const markerAngle = machineVisualAngle(degree);`,
  `        const markerAngle = tableFrameAngle + machineVisualAngle(degree);`,
  "table-frame degree markers"
);

source = replaceRequired(
  source,
  `    return \`<svg class="bottle-orientation-svg" viewBox="-145 -126 290 252" role="img" aria-label="Top-down bottle orientation at \${format(plateAngle, 1)} degrees">`,
  `    return \`<svg class="bottle-orientation-svg" data-top-view-frame="head-1-world" viewBox="-145 -126 290 252" role="img" aria-label="Top-down head 1 bottle orientation at table \${format(context.tableAngle, 1)} degrees and bottle \${format(plateAngle, 1)} degrees">`,
  "top-view world-frame annotation"
);

source = replaceRequired(
  source,
  `    contextFor,\n    machineVisualAngle,\n    topViewSvg,`,
  `    contextFor,\n    machineVisualAngle,\n    tableFrameVisualAngle,\n    headOneWorldVisualAngle,\n    topViewSvg,`,
  "head 1 transform exports"
);

source = replaceRequired(
  source,
  `    rightFrontZeroDatumV79: true,\n    oppositeCarouselBottleSpinV79: true`,
  `    rightFrontZeroDatumV79: true,\n    oppositeCarouselBottleSpinV79: true,\n    headOneWorldFrameTopViewV80: true,\n    mechanicalMapTransformParityV80: true`,
  "v80 world-frame feature flags"
);
write("app/bottle-orientation-panel-integration.js", source);

let bootstrap = read("app/bootstrap.js");
bootstrap = replaceRequired(
  bootstrap,
  `  const build = "${PREVIOUS_BUILD}";`,
  `  const build = "${BUILD}";`,
  "bootstrap build id"
);
bootstrap = bootstrap.replace(/const buildUpdatedAt = "[^"]+";/, `const buildUpdatedAt = "${UPDATED}";`);
if (!bootstrap.includes(`// Regression lineage: ${BUILD} •`)) {
  bootstrap = bootstrap.replace("// Regression lineage: ", `// Regression lineage: ${BUILD} • `);
}
write("app/bootstrap.js", bootstrap);

for (const path of [
  "app/update-manager.js",
  "service-worker.js",
  "index.html",
  "tests/map-workspace-bottle-visual-v75.test.js",
  "tests/entry-exit-dead-zone-overlay.test.js"
]) {
  let content = read(path);
  if (!content.includes(PREVIOUS_BUILD)) throw new Error(`Missing previous build id in ${path}`);
  content = content.split(PREVIOUS_BUILD).join(BUILD);
  write(path, content);
}

const manifestPath = "update-manifest.json";
const manifest = JSON.parse(read(manifestPath));
manifest.buildId = BUILD;
manifest.notes = "Staging v80 makes the Bottle Orientation Top View a magnified world-frame view of servo/head 1. Its 0/90/180/270 references rotate with the same table-frame transform used by the live Mechanical Map, while the bottle servo angle remains superimposed as the local plate rotation. Generated servo/HMI values are unchanged.";
write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

let test = read("tests/bottle-orientation-panel.test.js");
test = replaceRequired(
  test,
  `assert.match(source, /markerAngle = machineVisualAngle\\(degree\\)/);`,
  `assert.match(source, /function tableFrameVisualAngle/);\nassert.match(source, /angleToSvgRotation\\(normalizeAngle\\(tableAngle\\)\\)/);\nassert.match(source, /function headOneWorldVisualAngle/);\nassert.match(source, /return tableFrameVisualAngle\\(tableAngle\\) \\+ machineVisualAngle\\(plateAngle\\)/);\nassert.match(source, /markerAngle = tableFrameAngle \\+ machineVisualAngle\\(degree\\)/);\nassert.match(source, /data-top-view-frame=\\"head-1-world\\"/);\nassert.match(source, /headOneWorldFrameTopViewV80: true/);\nassert.match(source, /mechanicalMapTransformParityV80: true/);`,
  "v80 head 1 transform assertions"
);
test = test.split(PREVIOUS_BUILD).join(BUILD);
test = test.replace("Machine bottle datum alignment v79 regression passed.", "Head 1 world-frame top view v80 regression passed.");
write("tests/bottle-orientation-panel.test.js", test);

console.log(`Applied ${BUILD}`);
