"use strict";
const fs = require("fs");
const BUILD = "coder-measured-input-transform-v100-20260813-1546";
const PREVIOUS = "coder-servo-direction-transform-v99-20260813-1436";
const UPDATED = "Aug 13, 2026 3:46 PM ET";
function read(p){return fs.readFileSync(p,"utf8");}
function write(p,s){fs.writeFileSync(p,s);}
function req(s,a,b,label){if(!s.includes(a))throw new Error(`Missing ${label}`);return s.replace(a,b);}

let driver=read("drivers/profile/coder-orientation-driver.js");
driver=req(driver,"    const code = finite(codeBoxOffsetDeg, NaN);","    const code = Math.abs(finite(codeBoxOffsetDeg, NaN));","positive measured code-box input");
driver=req(driver,
`    // Resolve exactly one point on the printed artwork first. For Body/Back\n    // leading-edge application this is application + Code Box Center From Left\n    // Label Edge. Reversing the machine never substitutes the opposite label end.\n    const printedDatum = center - offset;\n\n    // Convert that same artwork point into the legacy/internal plate coordinate.\n    // The physical target stays the same, while the HMI/CMD target is allowed to\n    // be greater or smaller when the carousel direction changes.\n    const rawTarget = servoSign * printedDatum;`,
`    // Resolve the artwork position in the label's own measurement frame first.\n    // The user always enters the positive physical distance measured from the\n    // printed left edge; direction affects only the machine-local servo delta.\n    const printedDatum = center - offset;\n    const measuredLocalOffset = printedDatum - application;\n\n    // applicationTarget is already an internal servo/program angle. Do not mirror\n    // that established baseline again. Only the label-local measured offset gets\n    // the direction sign (for example: user +15 -> machine -15 when required).\n    const machineLocalOffset = servoSign * measuredLocalOffset;\n    const rawTarget = application + machineLocalOffset;`,
"local measured coder transform");
driver=req(driver,
`      printedCodeBoxDatum: printedDatum,\n      application,`,
`      printedCodeBoxDatum: printedDatum,\n      measuredLocalOffset,\n      machineLocalOffset,\n      application,`,
"coder offset metadata");
driver=req(driver,
`      directionInvariantLeftEdge: true,\n      directionDependentServoCommand: true`,
`      directionInvariantLeftEdge: true,\n      positiveMeasuredInput: true,\n      directionDependentServoCommand: true`,
"positive input feature flag");
write("drivers/profile/coder-orientation-driver.js",driver);

let specs=read("app/controllers/specs-controller.js");
specs=req(specs,
`        if (labelNumericFields.has(key)) spec[key] = numericInput(value, spec[key]);`,
`        if (labelNumericFields.has(key)) {\n          const numeric = numericInput(value, spec[key]);\n          // Code Box Center is a physical distance measured from the printed left\n          // edge. Store it as a positive measurement; the coder driver owns the\n          // machine-direction sign conversion.\n          spec[key] = key === "codeBoxCenterMm" && Number.isFinite(Number(numeric))\n            ? Math.abs(Number(numeric))\n            : numeric;\n        }`,
"positive code-box spec storage");
write("app/controllers/specs-controller.js",specs);

let renderer=read("app/specification-table-renderer.js");
renderer=req(renderer,
`"On the approved label drawing, measure from the label's left edge to the center of the coding box."`,
`"Enter the positive physical distance measured from the printed label's left edge to the center of the coding box. ServoForge converts the sign internally for machine direction."`,
"code-box measurement tooltip");
renderer=req(renderer,
`data-spec-field="codeBoxCenterMm" class="num" type="number" step="0.001"`,
`data-spec-field="codeBoxCenterMm" class="num" type="number" min="0" step="0.001"`,
"nonnegative code-box field");
write("app/specification-table-renderer.js",renderer);

let profile=read("app/profile-generation.js");
profile=req(profile,`  const moduleBuild = "servo-validator-plan-sync-v59-20260811";`,`  const moduleBuild = "${BUILD}";`,"profile module build");
profile=req(profile,
`      const expected = new URL(\`./\${path}\`, window.location.href).pathname;\n      const existing = [...document.scripts].find((script) => {\n        try { return new URL(script.src, window.location.href).pathname === expected; }\n        catch { return false; }\n      });`,
`      const expected = new URL(\`./\${path}?v=\${encodeURIComponent(version)}&build=\${encodeURIComponent(moduleBuild)}\`, window.location.href).href;\n      const existing = [...document.scripts].find((script) => script.src === expected);`,
"profile exact build URL loader");
write("app/profile-generation.js",profile);

let coderTest=read("tests/coder-left-edge-direction-parity-v98.test.js");
coderTest=coderTest.replace(
`assert.equal(ccw.rawTarget, 20, "20° from the printed left edge must remain 20° logically.");\nassert.equal(cw.rawTarget, 20, "Changing machine direction must not swap to the opposite printed edge.");\nassert.equal(ccw.target, cw.target);`,
`assert.equal(ccw.printedCodeBoxDatum, 20, "The printed artwork datum remains +20° from the left edge.");\nassert.equal(cw.printedCodeBoxDatum, 20, "Changing machine direction must not swap to the opposite printed edge.");\nassert.equal(ccw.measuredLocalOffset, 20);\nassert.equal(cw.measuredLocalOffset, 20);\nassert.equal(ccw.machineLocalOffset, 20);\nassert.equal(cw.machineLocalOffset, -20);\nassert.equal(ccw.rawTarget, 20);\nassert.equal(cw.rawTarget, -20);\nassert.notEqual(ccw.target, cw.target);`);
coderTest=coderTest.replace(
`assert.ok(Math.abs(landCcw.rawTarget - landCw.rawTarget) < 1e-9);\nassert.ok(Math.abs(landCcw.rawTarget - (90 + codeBoxOffsetDeg)) < 1e-9);`,
`assert.ok(Math.abs(landCcw.printedCodeBoxDatum - landCw.printedCodeBoxDatum) < 1e-9);\nassert.ok(Math.abs(landCcw.printedCodeBoxDatum - (90 + codeBoxOffsetDeg)) < 1e-9);\nassert.ok(Math.abs(landCcw.rawTarget - (90 + codeBoxOffsetDeg)) < 1e-9);\nassert.ok(Math.abs(landCw.rawTarget - (90 - codeBoxOffsetDeg)) < 1e-9);`);
coderTest=coderTest.replace("v98 keeps the exact printed code-box datum identical.","v100 keeps the measured printed datum identical while translating the machine-local sign.");
coderTest=coderTest.replace("Coder left-edge direction parity v98 regression passed.","Coder positive measured-input direction transform v100 regression passed.");
write("tests/coder-left-edge-direction-parity-v98.test.js",coderTest);

const v100Test=`"use strict";\nconst assert=require("node:assert/strict");\nconst driver=require("../drivers/profile/coder-orientation-driver.js");\nconst base={section:"back",applicationTarget:90,labelWidthDeg:100,codeBoxOffsetDeg:15,inspectionOffsetDeg:0,currentPlateAngle:90};\nconst physicalCw=driver.codeBoxTarget({...base,storedDirection:"ccw"});\nconst physicalCcw=driver.codeBoxTarget({...base,storedDirection:"cw"});\nassert.equal(physicalCw.printedCodeBoxDatum,105);\nassert.equal(physicalCcw.printedCodeBoxDatum,105);\nassert.equal(physicalCw.measuredLocalOffset,15);\nassert.equal(physicalCcw.measuredLocalOffset,15);\nassert.equal(physicalCw.machineLocalOffset,15);\nassert.equal(physicalCcw.machineLocalOffset,-15);\nassert.equal(physicalCw.rawTarget,105);\nassert.equal(physicalCcw.rawTarget,75);\nassert.equal(physicalCw.code,15);\nassert.equal(driver.codeBoxTarget({...base,codeBoxOffsetDeg:-15,storedDirection:"cw"}).code,15,"Legacy negative workaround is normalized to the physical measured magnitude.");\nconst neck={section:"neck",applicationTarget:40,labelWidthDeg:60,codeBoxOffsetDeg:10,inspectionOffsetDeg:0,currentPlateAngle:40};\nconst neckCw=driver.codeBoxTarget({...neck,storedDirection:"ccw"});\nconst neckCcw=driver.codeBoxTarget({...neck,storedDirection:"cw"});\nassert.equal(neckCw.measuredLocalOffset,-20);\nassert.equal(neckCcw.measuredLocalOffset,-20);\nassert.equal(neckCw.machineLocalOffset,-20);\nassert.equal(neckCcw.machineLocalOffset,20);\nassert.equal(neckCw.rawTarget,20);\nassert.equal(neckCcw.rawTarget,60);\nconsole.log("Coder measured positive input -> machine signed offset v100 regression passed.");\n`;
write("tests/coder-measured-input-transform-v100.test.js",v100Test);

let sensorTest=read("tests/sensor-direction-live-status.test.js");
sensorTest=sensorTest.replace(/assert\.match\(startupSource, \/first-application-zero-datum-v30-physical-sensor-visibility\/\);\nassert\.match\(startupSource, \/label-application-reference-v32\/\);\nassert\.match\(startupSource, \/first-tack-datum-flow-v41-20260808-2330\/\);/,
`assert.match(startupSource, /first-application-zero-datum-integration\\.js/);\nassert.match(bootstrapSource, /label-application-reference-v32/);\nassert.match(bootstrapSource, /first-tack-datum-flow-v41-20260808-2330/);`);
write("tests/sensor-direction-live-status.test.js",sensorTest);

for(const p of ["app.js","index.html","app/update-manager.js","service-worker.js"]){let s=read(p);if(!s.includes(PREVIOUS))throw new Error(`Missing ${PREVIOUS} in ${p}`);s=s.split(PREVIOUS).join(BUILD);write(p,s);}
let bootstrap=read("app/bootstrap.js");bootstrap=req(bootstrap,`  const build = "${PREVIOUS}";`,`  const build = "${BUILD}";`,"bootstrap build");bootstrap=bootstrap.replace(/  const buildUpdatedAt = "[^"]+";/,`  const buildUpdatedAt = "${UPDATED}";`);bootstrap=bootstrap.replace("// Regression lineage: ",`// Regression lineage: ${BUILD} • `);write("app/bootstrap.js",bootstrap);
let manifest=JSON.parse(read("update-manifest.json"));manifest.buildId=BUILD;manifest.notes="v100 lets operators enter the positive physical Code Box Center measurement exactly as measured from the printed left label edge. ServoForge now applies the machine-direction sign only to the label-local coder offset, preserving the existing application angle while generating the positive or negative servo correction the machine actually needs. Legacy negative workaround values are treated as measurement magnitudes. v99 physical direction/orientation behavior is retained.";write("update-manifest.json",JSON.stringify(manifest,null,2)+"\n");

console.log(`Applied ${BUILD}`);
