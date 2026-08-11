"use strict";

const fs = require("fs");

const PREVIOUS_BUILD = "machine-direction-bottle-orientation-v78-20260811-1752";
const BUILD = "machine-bottle-datum-alignment-v79-20260811-1756";
const UPDATED = "Aug 11, 2026 5:56 PM ET";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing ${label}`);
  return content.replace(from, to);
}

let source = read("app/bottle-orientation-panel-integration.js");
source = replaceRequired(source, "  const VERSION = 3;", "  const VERSION = 4;", "bottle orientation version");
source = replaceRequired(
  source,
  `  function polarPoint(angleDeg, radius, cx = 0, cy = 0) {\n    const radians = angleDeg * Math.PI / 180;\n    return {\n      x: cx + Math.sin(radians) * radius,\n      y: cy + Math.cos(radians) * radius\n    };\n  }`,
  `  function polarPoint(angleDeg, radius, cx = 0, cy = 0) {\n    const radians = angleDeg * Math.PI / 180;\n    // Bottle-local 0° uses the same +X/right-hand front reference as the\n    // Mechanical Map bottle renderer. Positive SVG angle is clockwise; the\n    // machineVisualAngle sign below makes servo rotation oppose carousel travel.\n    return {\n      x: cx + Math.cos(radians) * radius,\n      y: cy + Math.sin(radians) * radius\n    };\n  }`,
  "right-front bottle polar datum"
);
source = replaceRequired(
  source,
  `    return \`M \${start.x.toFixed(3)} \${start.y.toFixed(3)} A \${radius} \${radius} 0 \${span > 180 ? 1 : 0} 0 \${end.x.toFixed(3)} \${end.y.toFixed(3)}\`;`,
  `    return \`M \${start.x.toFixed(3)} \${start.y.toFixed(3)} A \${radius} \${radius} 0 \${span > 180 ? 1 : 0} 1 \${end.x.toFixed(3)} \${end.y.toFixed(3)}\`;`,
  "clockwise SVG arc sweep for +X polar basis"
);
source = replaceRequired(
  source,
  `    machineDirectionVisualV78: true,\n    directionAwareDegreeMarkersV78: true`,
  `    machineDirectionVisualV78: true,\n    directionAwareDegreeMarkersV78: true,\n    rightFrontZeroDatumV79: true,\n    oppositeCarouselBottleSpinV79: true`,
  "v79 bottle datum feature flags"
);
write("app/bottle-orientation-panel-integration.js", source);

let recovery = read("app/bottle-orientation-panel-recovery-integration.js");
recovery = replaceRequired(
  recovery,
  `    const svg = top?.querySelector?.(".bottle-orientation-svg");\n    if (!svg) return false;\n\n    const direction = machineDirection();`,
  `    const svg = top?.querySelector?.(".bottle-orientation-svg");\n    if (!svg) return false;\n\n    // v79 renders the correct +X/right-front bottle datum natively. Keep the\n    // reflection logic below only as a compatibility fallback for an older v78\n    // panel that may still be present during a rolling staging update.\n    if (api()?.rightFrontZeroDatumV79) {\n      svg.setAttribute(TOP_CORRECTION_ATTR, machineDirection());\n      svg.setAttribute("data-bottle-zero-datum", "right-front-reference");\n      svg.setAttribute("data-bottle-spin-relative-to-carousel", "opposite");\n      return true;\n    }\n\n    const direction = machineDirection();`,
  "native v79 datum recovery guard"
);
recovery = recovery.replace("  const VERSION = 2;", "  const VERSION = 3;");
recovery = recovery.replace(
  "    rightFrontZeroDatumV79: true\n",
  "    rightFrontZeroDatumV79: true,\n    nativeBottleDatumCompatibilityV79: true\n"
);
write("app/bottle-orientation-panel-recovery-integration.js", recovery);

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
if (!bootstrap.includes(`// Regression lineage: ${BUILD} • ${PREVIOUS_BUILD} •`)) {
  bootstrap = bootstrap.replace(
    `// Regression lineage: ${BUILD} •`,
    `// Regression lineage: ${BUILD} • ${PREVIOUS_BUILD} •`
  );
}
write("app/bootstrap.js", bootstrap);

const manifestPath = "update-manifest.json";
const manifest = JSON.parse(read(manifestPath));
manifest.buildId = BUILD;
manifest.notes = "Staging v79 aligns Bottle Orientation with the Mechanical Map bottle datum: 0° is the right-hand/front reference, a CW carousel displays positive bottle servo rotation counterclockwise, and a CCW carousel displays it clockwise. Generated servo/HMI angles are unchanged.";
write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

let test = read("tests/bottle-orientation-panel.test.js");
if (!test.includes("bottle-orientation-panel-recovery-integration.js")) {
  test = replaceRequired(
    test,
    `const source = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-integration.js"), "utf8");`,
    `const source = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-integration.js"), "utf8");\nconst recovery = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-recovery-integration.js"), "utf8");`,
    "recovery regression source"
  );
}
if (!test.includes("rightFrontZeroDatumV79")) {
  test = replaceRequired(
    test,
    `assert.match(source, /directionAwareDegreeMarkersV78: true/);`,
    `assert.match(source, /directionAwareDegreeMarkersV78: true/);\nassert.match(source, /rightFrontZeroDatumV79: true/);\nassert.match(source, /oppositeCarouselBottleSpinV79: true/);\nassert.match(source, /x: cx \\+ Math\\.cos\\(radians\\) \\* radius/);\nassert.match(source, /y: cy \\+ Math\\.sin\\(radians\\) \\* radius/);\nassert.match(source, /span > 180 \\? 1 : 0} 1 \\${end\\.x/);\nassert.match(recovery, /nativeBottleDatumCompatibilityV79: true/);`,
    "v79 datum regression assertions"
  );
}
test = test.replace("Machine-direction bottle orientation v78 regression passed.", "Machine bottle datum alignment v79 regression passed.");
write("tests/bottle-orientation-panel.test.js", test);

console.log(`Applied ${BUILD}`);
