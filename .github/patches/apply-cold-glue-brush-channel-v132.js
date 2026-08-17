"use strict";

const fs = require("node:fs");

const BUILD = "cold-glue-brush-channel-authority-v132-20260816-2250";
const UPDATED = "Aug 16, 2026 10:50 PM ET";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOrThrow(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing patch target: ${label}`);
  return source.replace(search, replacement);
}
function replaceRegexOrThrow(source, regex, replacement, label) {
  if (!regex.test(source)) throw new Error(`Missing regex patch target: ${label}`);
  return source.replace(regex, replacement);
}

let generator = read("app/cold-glue-profile-generation.js");
generator = replaceOrThrow(generator,
  '      motionSource: "cold-glue-machine-map",\n      ...extra',
  '      motionSource: "cold-glue-machine-map",\n      tackMode: "center",\n      centerTackOnly: true,\n      centerOutFromApplication: true,\n      leadingEdgeWipe: false,\n      ...extra',
  "Cold Glue row defaults");

const pairedPlan = [
  '  const pairedBrushPlan = (section, stationObjects) => {',
  '    const wipe = sectionWipePlan(section);',
  '    if (!wipe || !coldGlueDriver) return null;',
  '    const common = {',
  '      labelDeg: wipe.labelDeg,',
  '      overWipeDeg: wipe.overWipeDeg,',
  '      maxRatio: state.maxMoveRatio,',
  '      safetyFactor: 0.9,',
  '      mapDirection',
  '    };',
  '    const channels = stationObjects.filter((item) => item.kind === "brush-channel");',
  '    if (channels.length && typeof coldGlueDriver.createBrushChannelPlan === "function") {',
  '      return coldGlueDriver.createBrushChannelPlan({ ...common, channels });',
  '    }',
  '    const brushes = stationObjects.filter((item) => item.kind === "brush");',
  '    if (brushes.length && typeof coldGlueDriver.createPlan === "function") {',
  '      return coldGlueDriver.createPlan({ ...common, brushes });',
  '    }',
  '    return null;',
  '  };',
  '',
  '  add(3, 0, startPlate, "Zero Line");'
].join("\n");
generator = replaceRegexOrThrow(generator,
  /  const pairedBrushPlan = \(section, stationObjects\) => \{[\s\S]*?\n  \};\n\n  add\(3, 0, startPlate, "Zero Line"\);/,
  pairedPlan,
  "canonical pairedBrushPlan");

generator = replaceOrThrow(generator,
  '      // Cold-glue labels are only center/edge tacked when they leave the\n      // aggregate. Before the bottle enters the first brush channel, rotate the\n      // plate so the tacked portion points in the direction of bottle flow and\n      // the loose label tail trails behind it. Entering the channel in the\n      // opposite orientation lets the brushes catch and peel the unwiped label.\n      const allBrushAllocations = [\n        ...(Array.isArray(stationPlan.process) ? stationPlan.process : stationPlan.outside || []),\n        ...(Array.isArray(stationPlan.final) ? stationPlan.final : stationPlan.inside || []),\n        ...(Array.isArray(stationPlan.channelMoves) ? stationPlan.channelMoves : [])\n      ].filter((allocation) => Number.isFinite(num(allocation.start, NaN)))',
  '      // Cold Glue is center tack only. Complete the orientation move before\n      // first brush contact so the center-tacked label faces into the channel.\n      // Shared inside/outside brush overlap is a hold zone; bottle rotation is\n      // reserved for a one-sided opening after either brush side clears.\n      const allBrushAllocations = (Array.isArray(stationPlan.channelMoves) ? stationPlan.channelMoves : [])\n        .filter((allocation) => Number.isFinite(num(allocation.start, NaN)))',
  "center-tack allocation source");

generator = replaceOrThrow(generator,
  '        const alignmentExtra = { station, section, brushEntryAlignment: true, mapDirection, flowFacingOffsetDeg: mapDirection === "ccw" ? 90 : -90 };',
  '        const alignmentExtra = { station, section, brushEntryAlignment: true, preBrushRotation: true, centerTackOnly: true, tackMode: "center", leadingEdgeWipe: false, mapDirection, flowFacingOffsetDeg: mapDirection === "ccw" ? 90 : -90 };',
  "pre-brush metadata");

generator = replaceOrThrow(generator,
  '          moveToReference(brushEntryTable, flowFacingPlate, `${sectionLabel(section)} Face Bottle With Flow Before Brush Channel`, alignmentExtra);',
  '          moveToReference(brushEntryTable, flowFacingPlate, `${sectionLabel(section)} Pre-Spin Center-Tacked Label Before Brush Contact`, alignmentExtra);',
  "pre-brush action");

const channelRuntime = [
  '      if (Array.isArray(stationPlan.channelMoves)) {',
  '        stationPlan.channelMoves.forEach((allocation) => {',
  '          const commonExtra = {',
  '            station,',
  '            section,',
  '            brushStage: allocation.stage,',
  '            brushSide: allocation.side || null,',
  '            tackMode: "center",',
  '            centerTackOnly: true,',
  '            centerOutFromApplication: true,',
  '            leadingEdgeWipe: false',
  '          };',
  '          if (allocation.stage === "opposed") {',
  '            const holdAngle = allocation.holdCurrent ? plate : num(allocation.holdAngle, stationPlan.channelEntryAngle ?? 90);',
  '            const action = `${sectionLabel(section)} Parallel Brush Hold at ${finishAngle(holdAngle)}°`;',
  '            if (Math.abs(plate - holdAngle) > 0.001) {',
  '              moveToReferenceWithoutExtraLap(allocation.start, holdAngle, action, {',
  '                ...commonExtra,',
  '                channelHold: true,',
  '                parallelBrushHold: true,',
  '                holdAngle,',
  '                brushHoldUntil: allocation.end',
  '              });',
  '            } else {',
  '              const currentRest = rows[rows.length - 1];',
  '              if (Number(currentRest?.cmd) === 3) {',
  '                currentRest.action = action;',
  '                currentRest.channelHold = true;',
  '                currentRest.parallelBrushHold = true;',
  '                currentRest.holdAngle = finishAngle(holdAngle);',
  '                currentRest.brushHoldFrom = finishAngle(allocation.start);',
  '                currentRest.brushHoldUntil = finishAngle(Math.max(num(currentRest.brushHoldUntil, allocation.start), allocation.end));',
  '                currentRest.brushStage = "opposed";',
  '                currentRest.centerTackOnly = true;',
  '                currentRest.tackMode = "center";',
  '                currentRest.leadingEdgeWipe = false;',
  '              }',
  '            }',
  '            return;',
  '          }',
  '          if (allocation.rotation > 0.001) {',
  '            applyMove(',
  '              allocation.start,',
  '              allocation.end,',
  '              allocation.rotation,',
  '              allocation.direction,',
  '              `${sectionLabel(section)} ${allocation.stage === "outer" ? "Outside" : "Inside"} Brush Opening Center-Out Wipe`,',
  '              {',
  '                ...commonExtra,',
  '                singleSideOpening: true,',
  '                wipeOutward: true,',
  '                plannedRotation: allocation.rotation,',
  '                plannedRatio: allocation.ratio,',
  '                centerTackStage: allocation.centerTackStage',
  '              }',
  '            );',
  '          }',
  '        });',
  '      }',
  '    } else if (section)'
].join("\n");
generator = replaceRegexOrThrow(generator,
  /      if \(Array\.isArray\(stationPlan\.channelMoves\)\) \{[\s\S]*?\n      \}\n    \} else if \(section\)/,
  channelRuntime,
  "canonical brush runtime block");
write("app/cold-glue-profile-generation.js", generator);

let app = read("app.js");
app = app.replace(/const build = "[^"]+";/, `const build = "${BUILD}";`);
app = replaceRegexOrThrow(app,
  /\n    progress\?\.set\(76\.5, "Correcting Cold Glue center-tack brush entry…"\);\n    await loadScript\("app\/cold-glue-brush-direction-v128\.js", version\);\n\n    progress\?\.set\(76\.7, "Enforcing Cold Glue pre-brush spin and wipe direction…"\);\n    await loadScript\("app\/cold-glue-brush-runtime-v131\.js", version\);/,
  '\n    progress?.set(76.5, "Using canonical Cold Glue center-tack brush-channel planner…");',
  "legacy Cold Glue runtime loads");
write("app.js", app);

let profile = read("app/profile-generation.js");
profile = profile.replace(/const moduleBuild = "[^"]+";/, `const moduleBuild = "${BUILD}";`);
write("app/profile-generation.js", profile);

let bootstrap = read("app/bootstrap.js");
bootstrap = bootstrap.replace(/const build = "[^"]+";/, `const build = "${BUILD}";`);
bootstrap = bootstrap.replace(/const buildUpdatedAt = "[^"]+";/, `const buildUpdatedAt = "${UPDATED}";`);
write("app/bootstrap.js", bootstrap);

let index = read("index.html");
index = index.replaceAll("bottle-orientation-wipe-direction-v127-20260816-0935", BUILD);
write("index.html", index);

let worker = read("service-worker.js");
worker = worker.replace(/const CACHE_NAME = "[^"]+";/, `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-${BUILD}";`);
for (const legacy of [
  '  "./app/cold-glue-center-out-brush-integration.js",\n',
  '  "./app/cold-glue-neck-left-right-integration.js",\n'
]) worker = worker.replace(legacy, "");
write("service-worker.js", worker);

const manifest = JSON.parse(read("update-manifest.json"));
manifest.buildId = BUILD;
manifest.notes = "v132 makes the Cold Glue brush-channel planner the single brush-motion authority. Cold Glue remains center-tack only: bottles pre-spin before first brush contact, hold the brush-facing angle for every inside/outside parallel overlap, and only consume remaining center-out wipe rotation after one brush side opens. The turn ratio is calculated from the available one-sided opening length and physical machine direction. The v128/v131 and earlier center-out/left-right brush wrappers are retired.";
write("update-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

for (const legacyPath of [
  "app/cold-glue-brush-direction-v128.js",
  "app/cold-glue-brush-runtime-v131.js",
  "app/cold-glue-center-out-brush-integration.js",
  "app/cold-glue-neck-left-right-integration.js",
  "tests/cold-glue-brush-direction-v128.test.js",
  "tests/cold-glue-brush-runtime-v131.test.js",
  ".github/workflows/validate-cold-glue-brush-direction-v128.yml",
  ".github/workflows/validate-cold-glue-brush-runtime-v131.yml"
]) {
  if (fs.existsSync(legacyPath)) fs.rmSync(legacyPath);
}

console.log(`Applied ${BUILD}`);
