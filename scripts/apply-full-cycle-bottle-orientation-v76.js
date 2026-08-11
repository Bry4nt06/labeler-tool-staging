"use strict";

const fs = require("fs");

const BUILD = "full-cycle-bottle-orientation-v76-20260811-1713";
const UPDATED = "Aug 11, 2026 5:13 PM ET";
const PREVIOUS_BUILD = "map-layout-dead-zone-bottle-visual-v75-20260811-1628";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing ${label}`);
  return content.replace(from, to);
}
function replaceFunction(content, startMarker, nextMarker, replacement, label) {
  const start = content.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing ${label} start`);
  const end = content.indexOf(nextMarker, start);
  if (end < 0) throw new Error(`Missing ${label} end`);
  return content.slice(0, start) + replacement.trimEnd() + "\n\n  " + content.slice(end);
}

let source = read("app/bottle-orientation-panel-integration.js");
source = replaceOnce(source, "const VERSION = 1;", "const VERSION = 2;", "orientation panel version");
source = replaceOnce(source, "const BASE_DEG_PER_SECOND = 9;", "const BASE_DEG_PER_SECOND = 18;", "full-cycle playback speed");

source = replaceFunction(source, "function stationOnePath(program) {", "function currentUnwrappedAngle(path) {", `function stationOnePath(program) {
    // Compatibility name retained from v72. The returned path now spans the
    // entire generated servo cycle rather than Aggregate/Station 1 only.
    const segments = programSegmentsFor(program).filter((row) => Number.isFinite(finite(row?.tableAngle, NaN)));
    if (!segments.length) return { start: 0, end: 360, objects: [], rowSegments: [], fullCycle: true };

    let previousStart = NaN;
    const rowSegments = segments.map((row, index) => {
      let unwrappedStart = normalizeAngle(row.tableAngle);
      if (index > 0 && Number.isFinite(previousStart)) {
        while (unwrappedStart < previousStart - 0.001) unwrappedStart += 360;
      }
      previousStart = unwrappedStart;
      return { ...row, __orientationTableStart: unwrappedStart };
    });

    const start = rowSegments[0].__orientationTableStart;
    let end = Math.max(...rowSegments.map((row) => (
      row.__orientationTableStart + Math.max(0, finite(row?.tableTravel, 0))
    )));
    if (!Number.isFinite(end) || end <= start + 1) end = start + 360;
    end = clamp(end, start + 5, start + 720);

    const objects = Array.isArray(activeMap()?.objects) ? activeMap().objects : [];
    return { start, end, objects, rowSegments, fullCycle: true };
  }`, "full program path");

source = replaceFunction(source, "function stationOneCoverage(program, section, tableAngle, geometry) {", "function currentHardware(tableAngle) {", `function stationOneCoverage(program, section, tableAngle, geometry) {
    // Compatibility name retained; coverage now follows whichever section and
    // wipe station is active at this point in the full servo program.
    const service = global.LabelerWipeTelemetryService;
    if (!service) return { percentage: 0, leftPercent: 0, rightPercent: 0, tackMode: "center", direction: "ltr" };
    try {
      const telemetry = service.wipeDownTelemetry?.(program, normalizeAngle(tableAngle));
      if (telemetry?.section === section) return telemetry;
      const visual = service.wipeVisualApplication?.(section, geometry.lengthMm) || { tackMode: "center", direction: "ltr" };
      const coverage = service.contactedLabelCoverage?.(
        program,
        section,
        Number.isFinite(Number(telemetry?.station)) ? Number(telemetry.station) : null,
        normalizeAngle(tableAngle),
        visual
      ) || { percentage: 0, leftPercent: 0, rightPercent: 0 };
      return { ...visual, ...coverage };
    } catch {
      return { percentage: 0, leftPercent: 0, rightPercent: 0, tackMode: "center", direction: "ltr" };
    }
  }`, "dynamic wipe coverage");

source = replaceFunction(source, "function currentHardware(tableAngle) {", "function contextFor(source) {", `function currentHardware(tableAngle) {
    try {
      const context = global.LabelerWipeTelemetryService?.wipeStationContextAtAngle?.(normalizeAngle(tableAngle));
      return context?.object || null;
    } catch {
      return null;
    }
  }`, "all-station hardware");

source = replaceFunction(source, "function contextFor(source) {", "function polarPoint(angleDeg, radius, cx = 0, cy = 0) {", `function contextFor(source) {
    const program = programForSource(source);
    const path = stationOnePath(program);
    const tableAngle = currentUnwrappedAngle(path);
    const active = activeRowAt(tableAngle, program);
    const service = global.LabelerWipeTelemetryService;
    let telemetry = null;
    try { telemetry = service?.wipeDownTelemetry?.(program, normalizeAngle(tableAngle)) || null; } catch { telemetry = null; }

    const explicitSection = String(telemetry?.section || service?.wipeSectionFromRow?.(active) || "").toLowerCase();
    const section = ["neck", "body", "back"].includes(explicitSection) ? explicitSection : stationOneSection();
    const geometry = labelGeometry(section);
    const plateAngle = Number.isFinite(finite(telemetry?.plateAngle, NaN))
      ? finite(telemetry.plateAngle, 0)
      : bottleAngleAtTable(tableAngle, program);
    const coverage = telemetry?.section === section
      ? telemetry
      : stationOneCoverage(program, section, tableAngle, geometry);
    const hardware = currentHardware(tableAngle);
    const station = Number.isFinite(Number(telemetry?.station))
      ? Number(telemetry.station)
      : Number.isFinite(Number(active?.station))
        ? Number(active.station)
        : null;

    return {
      source,
      program,
      path,
      tableAngle,
      section,
      station,
      geometry,
      plateAngle,
      active,
      coverage,
      hardware,
      applicationStarted: Boolean(telemetry?.section) || finite(coverage?.percentage, 0) > 0
    };
  }`, "full-cycle context");

source = replaceFunction(source, "function sideViewSvg(context) {", "function panelMarkup(source) {", `function sideViewSvg(context) {
    const { section, plateAngle, geometry, coverage } = context;
    const cx = 145;
    const bodyHalf = clamp(39 * geometry.bottleDiameterMm / 60.68, 32, 47);
    const neckRatio = clamp(geometry.neckCirc / geometry.bodyCirc, 0.30, 0.46);
    const neckHalf = clamp(bodyHalf * neckRatio, 10.5, 17);
    const neckTop = 27;
    const neckBase = 68;
    const shoulderBottom = 91;
    const bodyBottom = 226;
    const bodyPath = [
      `M ${cx-neckHalf} ${neckTop}`,
      `L ${cx-neckHalf} ${neckBase-10}`,
      `C ${cx-neckHalf} ${neckBase+1} ${cx-bodyHalf*0.78} ${shoulderBottom-13} ${cx-bodyHalf} ${shoulderBottom}`,
      `C ${cx-bodyHalf-3} ${shoulderBottom+8} ${cx-bodyHalf} ${shoulderBottom+17} ${cx-bodyHalf} ${shoulderBottom+25}`,
      `L ${cx-bodyHalf} ${bodyBottom-15}`,
      `C ${cx-bodyHalf} ${bodyBottom-4} ${cx-bodyHalf-9} ${bodyBottom} ${cx-bodyHalf-20} ${bodyBottom}`,
      `L ${cx+bodyHalf-20} ${bodyBottom}`,
      `C ${cx+bodyHalf-9} ${bodyBottom} ${cx+bodyHalf} ${bodyBottom-4} ${cx+bodyHalf} ${bodyBottom-15}`,
      `L ${cx+bodyHalf} ${shoulderBottom+25}`,
      `C ${cx+bodyHalf} ${shoulderBottom+17} ${cx+bodyHalf-3} ${shoulderBottom+8} ${cx+bodyHalf} ${shoulderBottom}`,
      `C ${cx+bodyHalf*0.78} ${shoulderBottom-13} ${cx+neckHalf} ${neckBase+1} ${cx+neckHalf} ${neckBase-10}`,
      `L ${cx+neckHalf} ${neckTop}`,
      "Z"
    ].join(" ");

    const labelRadius = section === "neck" ? neckHalf : bodyHalf;
    const chordWidth = clamp(2 * labelRadius * Math.abs(Math.sin(Math.min(179, geometry.labelDeg) * Math.PI / 360)), 15, bodyHalf * 2);
    const baseCenter = section === "back" ? 180 : 0;
    const labelFacingAngle = normalizeAngle(baseCenter + plateAngle);
    const projectedOffset = Math.sin(labelFacingAngle * Math.PI / 180) * labelRadius * .48;
    const labelX = cx + projectedOffset - chordWidth / 2;
    const labelY = section === "neck" ? 55 : 128;
    const labelHeight = section === "neck"
      ? clamp(finite(geometry.label?.neckHeightMm, 30) / geometry.bottleDiameterMm * 42, 20, 38)
      : 48;
    const leftWidth = chordWidth / 2 * clamp(finite(coverage.leftPercent, 0), 0, 100) / 100;
    const rightWidth = chordWidth / 2 * clamp(finite(coverage.rightPercent, 0), 0, 100) / 100;
    const labelColor = SECTION_COLORS[section] || "#4ca8ff";
    const centerlineX = cx + Math.sin(plateAngle * Math.PI / 180) * bodyHalf * .74;
    const hardwareActive = Boolean(context.hardware) || finite(coverage.percentage, 0) > 0;
    const hardwareY = labelY + labelHeight / 2;
    const stationText = context.station ? `S${context.station}` : "--";

    return `<svg class="bottle-orientation-svg" viewBox="0 0 290 252" role="img" aria-label="Clear glass bottle side view with ${section} label wipe progress">
      <defs>
        <linearGradient id="bottleSideGlass-${context.source}" x1="0" x2="1">
          <stop offset="0" stop-color="#dbe8ef" stop-opacity=".18"/>
          <stop offset=".16" stop-color="#9fb1bc" stop-opacity=".08"/>
          <stop offset=".42" stop-color="#eff8fc" stop-opacity=".05"/>
          <stop offset=".68" stop-color="#70818d" stop-opacity=".10"/>
          <stop offset=".88" stop-color="#e4eff5" stop-opacity=".16"/>
          <stop offset="1" stop-color="#8ea1ad" stop-opacity=".08"/>
        </linearGradient>
        <linearGradient id="bottleHighlight-${context.source}" x1="0" x2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity=".04"/><stop offset=".45" stop-color="#ffffff" stop-opacity=".34"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <clipPath id="bottleClip-${context.source}"><path d="${bodyPath}"/></clipPath>
      </defs>
      <text x="145" y="14" text-anchor="middle" class="view-title">SIDE VIEW</text>
      <path d="${bodyPath}" fill="url(#bottleSideGlass-${context.source})" stroke="#9eafb9" stroke-opacity=".78" stroke-width="2"/>
      <path d="M ${cx-bodyHalf+8} ${shoulderBottom+7} C ${cx-bodyHalf+14} ${shoulderBottom+17} ${cx-bodyHalf+14} ${bodyBottom-32} ${cx-bodyHalf+13} ${bodyBottom-18}" fill="none" stroke="#f0f7fa" stroke-opacity=".30" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M ${cx+bodyHalf-8} ${shoulderBottom+7} C ${cx+bodyHalf-14} ${shoulderBottom+17} ${cx+bodyHalf-14} ${bodyBottom-42} ${cx+bodyHalf-13} ${bodyBottom-22}" fill="none" stroke="#82949f" stroke-opacity=".25" stroke-width="2.2" stroke-linecap="round"/>
      <rect x="${cx-neckHalf-1.5}" y="${neckTop-7}" width="${neckHalf*2+3}" height="7" rx="2.5" fill="#c6d4dc" fill-opacity=".08" stroke="#aabac3" stroke-opacity=".75" stroke-width="1.2"/>
      <line x1="${cx-neckHalf-3}" y1="${neckTop-3}" x2="${cx+neckHalf+3}" y2="${neckTop-3}" stroke="#d7e3e9" stroke-opacity=".62" stroke-width="1.2"/>
      <line x1="${cx-neckHalf-2}" y1="${neckTop+5}" x2="${cx+neckHalf+2}" y2="${neckTop+5}" stroke="#b7c6ce" stroke-opacity=".48" stroke-width="1"/>
      <line x1="${cx-neckHalf-1}" y1="${neckTop+11}" x2="${cx+neckHalf+1}" y2="${neckTop+11}" stroke="#aebec7" stroke-opacity=".40" stroke-width="1"/>
      <line x1="${centerlineX}" y1="20" x2="${centerlineX}" y2="224" stroke="#ff4d3a" stroke-width="2.2" stroke-dasharray="6 5" clip-path="url(#bottleClip-${context.source})"/>
      <rect x="${labelX}" y="${labelY}" width="${chordWidth}" height="${labelHeight}" rx="3" fill="#4aa6d8" fill-opacity="${context.applicationStarted ? .32 : .10}" stroke="#8fd3f1" stroke-opacity=".72" stroke-width="1"/>
      ${leftWidth > .2 ? `<rect x="${labelX + chordWidth/2 - leftWidth}" y="${labelY}" width="${leftWidth}" height="${labelHeight}" rx="2" fill="${labelColor}" fill-opacity=".72"/>` : ""}
      ${rightWidth > .2 ? `<rect x="${labelX + chordWidth/2}" y="${labelY}" width="${rightWidth}" height="${labelHeight}" rx="2" fill="${labelColor}" fill-opacity=".72"/>` : ""}
      <line x1="${labelX+chordWidth/2}" y1="${labelY-5}" x2="${labelX+chordWidth/2}" y2="${labelY+labelHeight+5}" stroke="#fff" stroke-width="1" stroke-dasharray="3 3" opacity=".72"/>
      <g transform="translate(${cx+bodyHalf+12} ${hardwareY})" opacity="${hardwareActive ? 1 : .32}">
        <circle cx="0" cy="0" r="13" fill="#1d252b" stroke="#788996" stroke-width="1.6"/>
        <circle cx="0" cy="0" r="4.5" fill="${hardwareActive ? labelColor : "#52606a"}"/>
        <text x="0" y="24" text-anchor="middle" class="view-mini">${escapeHtml(stationText)}</text>
      </g>
      <text x="145" y="245" text-anchor="middle" class="view-readout">${escapeHtml(section.toUpperCase())} • ${format(geometry.lengthMm, 1)} mm • ${format(coverage.percentage, 0)}% wiped</text>
    </svg>`;
  }`, "realistic clear bottle side view");

source = source
  .replaceAll("Station 1 live geometry • synchronized side + top views", "Full servo cycle • synchronized side + top views")
  .replaceAll("<div><span>Station 1 label</span>", "<div><span>Station / label</span>")
  .replaceAll("Play Station 1", "Play Full Cycle")
  .replaceAll("Pause Station 1", "Pause Full Cycle")
  .replaceAll("Station 1 path", "Full program path")
  .replaceAll("Waiting for Station 1 program data.", "Waiting for servo program data.")
  .replaceAll("the same Station 1 servo/map data used by ServoForge", "the full generated servo program and active map geometry used by ServoForge");

source = replaceOnce(
  source,
  'setText(panel, "[data-orientation-section]", `${context.section[0].toUpperCase()}${context.section.slice(1)} • ${format(context.geometry.labelDeg, 1)}°`);',
  'setText(panel, "[data-orientation-section]", `${context.station ? `S${context.station} • ` : ""}${context.section[0].toUpperCase()}${context.section.slice(1)} • ${format(context.geometry.labelDeg, 1)}°`);',
  "station/label metric"
);

source = replaceOnce(
  source,
  "    stationOnePath,\n    contextFor,",
  "    stationOnePath,\n    fullProgramPath: stationOnePath,\n    contextFor,",
  "full path API alias"
);
source = replaceOnce(
  source,
  "    wipeTelemetryDrivenV72: true",
  "    wipeTelemetryDrivenV72: true,\n    fullCycleVisualV76: true,\n    clearLongNeckBottleV76: true",
  "v76 capability flags"
);
write("app/bottle-orientation-panel-integration.js", source);

let bootstrap = read("app/bootstrap.js");
bootstrap = replaceOnce(bootstrap, `const build = "${PREVIOUS_BUILD}";`, `const build = "${BUILD}";`, "bootstrap build");
bootstrap = replaceOnce(bootstrap, 'const buildUpdatedAt = "Aug 11, 2026 4:28 PM ET";', `const buildUpdatedAt = "${UPDATED}";`, "bootstrap timestamp");
bootstrap = replaceOnce(bootstrap, `// Regression lineage: ${PREVIOUS_BUILD}`, `// Regression lineage: ${BUILD} • ${PREVIOUS_BUILD}`, "bootstrap lineage");
write("app/bootstrap.js", bootstrap);

let index = read("index.html");
index = index.split(`build=${PREVIOUS_BUILD}`).join(`build=${BUILD}`);
write("index.html", index);

let manager = read("app/update-manager.js");
manager = replaceOnce(manager, `const BUILD_ID = "${PREVIOUS_BUILD}";`, `const BUILD_ID = "${BUILD}";`, "update manager build");
write("app/update-manager.js", manager);

let sw = read("service-worker.js");
sw = replaceOnce(
  sw,
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-${PREVIOUS_BUILD}";`,
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-${BUILD}";`,
  "service worker cache"
);
write("service-worker.js", sw);

write("update-manifest.json", JSON.stringify({
  schemaVersion: 1,
  version: "0.9.10",
  buildId: BUILD,
  releaseUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  downloadUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  notes: "Staging v76 redesigns the Bottle Orientation side view as a slimmer clear-glass long-neck bottle and changes the orientation player from the old Station/Aggregate 1 preview to the complete generated servo cycle. Playback now follows every servo row through all label/wipe stations, dynamically switches Neck/Body/Back geometry and active station telemetry, and keeps the Servo Program and Servo Simulation visuals synchronized."
}, null, 2) + "\n");

const test = `"use strict";\n\nconst assert = require("assert");\nconst fs = require("fs");\nconst path = require("path");\nconst root = path.resolve(__dirname, "..");\nconst source = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-integration.js"), "utf8");\nconst bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");\nconst serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");\nconst manifest = JSON.parse(fs.readFileSync(path.join(root, "update-manifest.json"), "utf8"));\n\nassert.match(source, /Bottle Orientation &amp; Wipe Visual/);\nassert.match(source, /Full servo cycle/);\nassert.match(source, /Play Full Cycle/);\nassert.match(source, /Full program path/);\nassert.match(source, /fullCycleVisualV76: true/);\nassert.match(source, /clearLongNeckBottleV76: true/);\nassert.match(source, /fullProgramPath: stationOnePath/);\nassert.match(source, /__orientationTableStart/);\nassert.doesNotMatch(source, /rowStart > start \\+ 150/);\nassert.match(source, /wipeDownTelemetry/);\nassert.match(source, /telemetry\\?\\.station/);\nassert.match(source, /wipeStationContextAtAngle/);\nassert.match(source, /clear glass bottle side view/);\nassert.match(source, /stop-color="#dbe8ef"/);\nassert.match(source, /stop-opacity="\\.18"/);\nassert.match(source, /C \\${cx-neckHalf} \\${neckBase\\+1}/);\nassert.match(source, /programForSource\\(source\\)/);\nassert.match(source, /source === "simulation"/);\nassert.match(source, /return generatedProgram\\(\\)/);\nassert.match(source, /selectedLabelSpec/);\nassert.match(source, /selectedBottleSpec/);\nassert.match(source, /bodyCircumference/);\nassert.match(source, /degFromMm/);\nassert.match(source, /\\[0,90,180,270\\]/);\nassert.match(source, /TOP VIEW/);\nassert.match(source, /SIDE VIEW/);\nassert.match(source, /data-orientation-scrubber/);\nassert.match(source, /wrapRenderer\\("renderProgram", "program"\\)/);\nassert.match(source, /wrapRenderer\\("renderSimulation", "simulation"\\)/);\nassert.match(source, /programAccessibleWithoutSimulationV72/);\nassert.match(bootstrap, /${BUILD}/);\nassert.match(serviceWorker, /${BUILD}/);\nassert.equal(manifest.buildId, "${BUILD}");\nconsole.log("Full-cycle bottle orientation v76 regression passed.");\n`;
write("tests/bottle-orientation-panel.test.js", test);

console.log(`Applied ${BUILD}`);
