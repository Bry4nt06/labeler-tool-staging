"use strict";

const fs = require("fs");

const BUILD = "reference-bottle-wrap-sync-v77-20260811-1748";
const UPDATED = "Aug 11, 2026 5:48 PM ET";
const PREVIOUS = "full-cycle-bottle-orientation-v76-20260811-1713";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceRequired(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing ${label}`);
  return content.replace(from, to);
}

let source = read("app/bottle-orientation-panel-integration.js");
source = replaceRequired(source, "  const VERSION = 2;", "  const VERSION = 3;", "orientation version");

const oldCoverage = `    const coverage = telemetry?.section === section\n      ? telemetry\n      : stationOneCoverage(program, section, tableAngle, geometry);\n    const hardware = currentHardware(tableAngle);`;
const newCoverage = `    const rawCoverage = telemetry?.section === section\n      ? telemetry\n      : stationOneCoverage(program, section, tableAngle, geometry);\n    let applicationVisual = null;\n    try { applicationVisual = service?.wipeVisualApplication?.(section, geometry.lengthMm) || null; } catch { applicationVisual = null; }\n    const coverage = { ...(applicationVisual || {}), ...(rawCoverage || {}) };\n    // Body and Back are physically leading-edge applications in ServoForge.\n    // Preserve Neck center-tack behavior unless the Neck application itself is\n    // configured as Leading Edge. This is a presentation correction only; the\n    // generated servo program and wipe telemetry remain authoritative.\n    if (section === "body" || section === "back") coverage.tackMode = "leading";\n    if (!coverage.direction) coverage.direction = runtimeState()?.direction === "cw" ? "ltr" : "rtl";\n    const hardware = currentHardware(tableAngle);`;
source = replaceRequired(source, oldCoverage, newCoverage, "coverage application semantics");

const helperAnchor = "\n  function topViewSvg(context) {";
if (!source.includes(helperAnchor)) throw new Error("Missing top view helper anchor");
const helpers = `
  function labelArcModel(context) {
    const { section, plateAngle, geometry, coverage } = context;
    const center = (section === "back" ? 180 : 0) + plateAngle;
    const half = geometry.labelDeg / 2;
    const tackMode = (section === "body" || section === "back")
      ? "leading"
      : String(coverage?.tackMode || "center").toLowerCase();
    const direction = String(coverage?.direction || (runtimeState()?.direction === "cw" ? "ltr" : "rtl")).toLowerCase() === "rtl"
      ? "rtl"
      : "ltr";
    const start = center - half;
    const end = center + half;
    const leftDegrees = half * clamp(finite(coverage?.leftPercent, 0), 0, 100) / 100;
    const rightDegrees = half * clamp(finite(coverage?.rightPercent, 0), 0, 100) / 100;
    const contacted = Math.min(geometry.labelDeg, leftDegrees + rightDegrees);
    const leadingEdge = direction === "rtl" ? end : start;
    const wipeRanges = [];
    if (tackMode === "leading") {
      if (contacted > 0.05) {
        if (direction === "rtl") wipeRanges.push([end - contacted, end]);
        else wipeRanges.push([start, start + contacted]);
      }
    } else {
      if (leftDegrees > 0.05) wipeRanges.push([center - leftDegrees, center]);
      if (rightDegrees > 0.05) wipeRanges.push([center, center + rightDegrees]);
    }
    return { center, half, start, end, tackMode, direction, leadingEdge, wipeRanges };
  }

  function frontFacingAngle(angleDeg) {
    return Math.cos(Number(angleDeg) * Math.PI / 180) >= -0.0001;
  }

  function projectLabelArcSegments(startDeg, endDeg, radius, centerX) {
    let start = Number(startDeg);
    let end = Number(endDeg);
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(radius)) return [];
    while (end < start) end += 360;
    const span = Math.min(359.5, Math.max(0, end - start));
    const steps = Math.max(18, Math.ceil(span / 2));
    const groups = [];
    let current = null;
    for (let index = 0; index <= steps; index += 1) {
      const angle = start + span * index / steps;
      if (!frontFacingAngle(angle)) {
        if (current) { groups.push(current); current = null; }
        continue;
      }
      const x = centerX + Math.sin(angle * Math.PI / 180) * radius;
      if (!current) current = { minX: x, maxX: x };
      else {
        current.minX = Math.min(current.minX, x);
        current.maxX = Math.max(current.maxX, x);
      }
    }
    if (current) groups.push(current);
    return groups
      .map((group) => ({ x: group.minX, width: Math.max(0.8, group.maxX - group.minX) }))
      .filter((group) => group.width > 0.75);
  }

  function projectedTackX(angleDeg, radius, centerX) {
    return frontFacingAngle(angleDeg)
      ? centerX + Math.sin(Number(angleDeg) * Math.PI / 180) * radius
      : null;
  }
`;
source = source.replace(helperAnchor, helpers + helperAnchor);

const topRegex = /  function topViewSvg\(context\) \{[\s\S]*?\n  \}\n\n  function sideViewSvg\(context\) \{/;
if (!topRegex.test(source)) throw new Error("Unable to locate top/side view block");
const topReplacement = `  function topViewSvg(context) {
    const { section, plateAngle, geometry, coverage } = context;
    const bodyRadius = 66;
    const neckRadius = clamp(bodyRadius * geometry.neckCirc / geometry.bodyCirc, 25, 49);
    const labelRadius = section === "neck" ? neckRadius : bodyRadius;
    const labelColor = SECTION_COLORS[section] || "#4ca8ff";
    const model = labelArcModel(context);
    const front = polarPoint(plateAngle, bodyRadius - 5);
    const labelCenterPoint = polarPoint(model.center, labelRadius - 5);
    const hardwareActive = Boolean(context.hardware) || finite(coverage.percentage, 0) > 0;
    const fullArc = arcPath(0, 4, labelRadius, model.start, model.end);
    const wipedArcs = model.wipeRanges.map(([start, end]) => arcPath(0, 4, labelRadius, start, end));
    const tackPoint = polarPoint(model.tackMode === "leading" ? model.leadingEdge : model.center, labelRadius, 0, 4);

    return \`<svg class="bottle-orientation-svg" viewBox="-145 -126 290 252" role="img" aria-label="Top-down bottle orientation at \${format(plateAngle, 1)} degrees">
      <defs>
        <radialGradient id="bottleTopGlass-\${context.source}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#5b3828"/><stop offset="0.55" stop-color="#271b17"/><stop offset="1" stop-color="#0b0f13"/></radialGradient>
      </defs>
      <circle cx="0" cy="4" r="84" fill="#070c11" stroke="#6e7780" stroke-width="2"/>
      <circle cx="0" cy="4" r="77" fill="none" stroke="#b4bcc4" stroke-opacity=".35" stroke-width="1"/>
      \${[0,90,180,270].map((degree) => {
        const inner = polarPoint(degree, 83, 0, 4);
        const outer = polarPoint(degree, 94, 0, 4);
        const text = polarPoint(degree, 108, 0, 4);
        return \`<line x1="\${inner.x}" y1="\${inner.y}" x2="\${outer.x}" y2="\${outer.y}" stroke="#ff5b3d" stroke-width="2"/><text x="\${text.x}" y="\${text.y + 4}" text-anchor="middle" class="degree-label">\${degree}°</text>\`;
      }).join("")}
      <circle cx="0" cy="4" r="\${bodyRadius}" fill="url(#bottleTopGlass-\${context.source})" stroke="#a07155" stroke-width="2"/>
      <circle cx="0" cy="4" r="\${neckRadius}" fill="#171313" stroke="#76503d" stroke-width="1.2"/>
      <circle cx="0" cy="4" r="11" fill="#2188d8" stroke="#a8ddff" stroke-width="1.2"/>
      <path d="\${fullArc}" fill="none" stroke="#397ea9" stroke-opacity="\${context.applicationStarted ? .46 : .18}" stroke-width="\${section === "neck" ? 10 : 13}" stroke-linecap="round"/>
      \${wipedArcs.map((path) => \`<path d="\${path}" fill="none" stroke="\${labelColor}" stroke-width="\${section === "neck" ? 10 : 13}" stroke-linecap="round"/>\`).join("")}
      <line x1="0" y1="4" x2="\${front.x}" y2="\${front.y + 4}" stroke="#ff4d3a" stroke-width="2.3" stroke-dasharray="5 4"/>
      <circle cx="\${labelCenterPoint.x}" cy="\${labelCenterPoint.y + 4}" r="2.8" fill="#fff" stroke="\${labelColor}" stroke-width="1.2"/>
      <circle cx="\${tackPoint.x}" cy="\${tackPoint.y}" r="3.2" fill="\${model.tackMode === "leading" ? "#ffd05f" : "#ffffff"}" stroke="#091017" stroke-width="1"/>
      <g transform="translate(86 4)" opacity="\${hardwareActive ? 1 : .42}">
        <rect x="-5" y="-17" width="14" height="34" rx="5" fill="\${hardwareActive ? "#ff6a3d" : "#4f5962"}" stroke="#f5a07f" stroke-width="1"/>
        <text x="2" y="28" text-anchor="middle" class="hardware-label">WIPE</text>
      </g>
      <text x="0" y="-106" text-anchor="middle" class="view-title">TOP VIEW</text>
      <text x="0" y="116" text-anchor="middle" class="view-readout">Bottle \${format(plateAngle, 1)}° • \${model.tackMode === "leading" ? "Leading edge" : "Center tack"}</text>
    </svg>\`;
  }

  function sideViewSvg(context) {`;
source = source.replace(topRegex, topReplacement);

const sideRegex = /  function sideViewSvg\(context\) \{[\s\S]*?\n  \}\n\n  function panelMarkup\(source\) \{/;
if (!sideRegex.test(source)) throw new Error("Unable to locate side view block");
const sideReplacement = `  function sideViewSvg(context) {
    const { section, plateAngle, geometry, coverage } = context;
    const cx = 145;
    // Reference-style 12 oz long-neck profile: narrow cylindrical body,
    // rounded base, short shoulders, long straight neck, and three lip rings.
    const bodyHalf = clamp(36 * geometry.bottleDiameterMm / 60.68, 31, 43);
    const neckRatio = clamp(geometry.neckCirc / geometry.bodyCirc, 0.30, 0.43);
    const neckHalf = clamp(bodyHalf * neckRatio, 10, 14.5);
    const neckTop = 27;
    const neckBase = 72;
    const shoulderBottom = 101;
    const bodyBottom = 226;
    const bodyPath = [
      \`M \${cx-neckHalf} \${neckTop}\`,
      \`L \${cx-neckHalf} \${neckBase-7}\`,
      \`C \${cx-neckHalf} \${neckBase+3} \${cx-bodyHalf*0.55} \${shoulderBottom-19} \${cx-bodyHalf*0.86} \${shoulderBottom-8}\`,
      \`C \${cx-bodyHalf*0.96} \${shoulderBottom-4} \${cx-bodyHalf} \${shoulderBottom+1} \${cx-bodyHalf} \${shoulderBottom+9}\`,
      \`L \${cx-bodyHalf} \${bodyBottom-15}\`,
      \`C \${cx-bodyHalf} \${bodyBottom-5} \${cx-bodyHalf-8} \${bodyBottom} \${cx-bodyHalf-19} \${bodyBottom}\`,
      \`L \${cx+bodyHalf-19} \${bodyBottom}\`,
      \`C \${cx+bodyHalf-8} \${bodyBottom} \${cx+bodyHalf} \${bodyBottom-5} \${cx+bodyHalf} \${bodyBottom-15}\`,
      \`L \${cx+bodyHalf} \${shoulderBottom+9}\`,
      \`C \${cx+bodyHalf} \${shoulderBottom+1} \${cx+bodyHalf*0.96} \${shoulderBottom-4} \${cx+bodyHalf*0.86} \${shoulderBottom-8}\`,
      \`C \${cx+bodyHalf*0.55} \${shoulderBottom-19} \${cx+neckHalf} \${neckBase+3} \${cx+neckHalf} \${neckBase-7}\`,
      \`L \${cx+neckHalf} \${neckTop}\`,
      "Z"
    ].join(" ");

    const labelRadius = section === "neck" ? neckHalf : bodyHalf;
    const model = labelArcModel(context);
    const labelY = section === "neck" ? 70 : 128;
    const labelHeight = section === "neck"
      ? clamp(finite(geometry.label?.neckHeightMm, 30) / geometry.bottleDiameterMm * 40, 19, 34)
      : 43;
    const labelColor = SECTION_COLORS[section] || "#4ca8ff";
    const labelSegments = projectLabelArcSegments(model.start, model.end, labelRadius, cx);
    const wipedSegments = model.wipeRanges.flatMap(([start, end]) => projectLabelArcSegments(start, end, labelRadius, cx));
    const tackX = projectedTackX(model.tackMode === "leading" ? model.leadingEdge : model.center, labelRadius, cx);
    const centerlineX = cx + Math.sin(plateAngle * Math.PI / 180) * bodyHalf * .74;
    const hardwareActive = Boolean(context.hardware) || finite(coverage.percentage, 0) > 0;
    const hardwareY = labelY + labelHeight / 2;
    const stationText = context.station ? \`S\${context.station}\` : "--";
    const labelOpacity = context.applicationStarted ? .34 : .10;

    return \`<svg class="bottle-orientation-svg" viewBox="0 0 290 252" role="img" aria-label="Reference-style clear glass bottle side view with \${section} label wrapped to bottle rotation">
      <defs>
        <linearGradient id="bottleSideGlass-\${context.source}" x1="0" x2="1">
          <stop offset="0" stop-color="#dce9ef" stop-opacity=".25"/>
          <stop offset=".12" stop-color="#f2f8fb" stop-opacity=".12"/>
          <stop offset=".30" stop-color="#81939e" stop-opacity=".07"/>
          <stop offset=".50" stop-color="#eef7fb" stop-opacity=".045"/>
          <stop offset=".72" stop-color="#738591" stop-opacity=".08"/>
          <stop offset=".90" stop-color="#f0f7fa" stop-opacity=".15"/>
          <stop offset="1" stop-color="#99aab4" stop-opacity=".12"/>
        </linearGradient>
        <linearGradient id="labelGlass-\${context.source}" x1="0" x2="1"><stop offset="0" stop-color="#4eaee0" stop-opacity=".42"/><stop offset=".5" stop-color="#3d9bc8" stop-opacity=".30"/><stop offset="1" stop-color="#4eaee0" stop-opacity=".42"/></linearGradient>
        <clipPath id="bottleClip-\${context.source}"><path d="\${bodyPath}"/></clipPath>
      </defs>
      <text x="145" y="14" text-anchor="middle" class="view-title">SIDE VIEW</text>
      <path d="\${bodyPath}" fill="url(#bottleSideGlass-\${context.source})" stroke="#b7c4ca" stroke-opacity=".82" stroke-width="2"/>
      <path d="M \${cx-bodyHalf+7} \${shoulderBottom+4} C \${cx-bodyHalf+12} \${shoulderBottom+14} \${cx-bodyHalf+12} \${bodyBottom-34} \${cx-bodyHalf+11} \${bodyBottom-17}" fill="none" stroke="#f7fbfd" stroke-opacity=".39" stroke-width="3" stroke-linecap="round"/>
      <path d="M \${cx+bodyHalf-7} \${shoulderBottom+4} C \${cx+bodyHalf-12} \${shoulderBottom+14} \${cx+bodyHalf-12} \${bodyBottom-40} \${cx+bodyHalf-11} \${bodyBottom-20}" fill="none" stroke="#94a5ae" stroke-opacity=".22" stroke-width="2" stroke-linecap="round"/>
      <rect x="\${cx-neckHalf-2}" y="20" width="\${neckHalf*2+4}" height="7" rx="2.5" fill="#d8e3e8" fill-opacity=".10" stroke="#c1cdd3" stroke-opacity=".78" stroke-width="1.2"/>
      <rect x="\${cx-neckHalf-3}" y="27" width="\${neckHalf*2+6}" height="6" rx="2" fill="#cbd8de" fill-opacity=".08" stroke="#b3c2ca" stroke-opacity=".68" stroke-width="1"/>
      <rect x="\${cx-neckHalf-2}" y="33" width="\${neckHalf*2+4}" height="6" rx="2" fill="#c2d0d7" fill-opacity=".07" stroke="#aabac3" stroke-opacity=".60" stroke-width="1"/>
      <line x1="\${centerlineX}" y1="18" x2="\${centerlineX}" y2="228" stroke="#ff4d3a" stroke-width="2.2" stroke-dasharray="6 5" clip-path="url(#bottleClip-\${context.source})"/>
      <g clip-path="url(#bottleClip-\${context.source})" data-wrapped-label="true">
        \${labelSegments.map((segment) => \`<rect x="\${segment.x}" y="\${labelY}" width="\${segment.width}" height="\${labelHeight}" rx="2.5" fill="url(#labelGlass-\${context.source})" fill-opacity="\${labelOpacity}" stroke="#8fd3f1" stroke-opacity=".68" stroke-width=".8"/>\`).join("")}
        \${wipedSegments.map((segment) => \`<rect x="\${segment.x}" y="\${labelY}" width="\${segment.width}" height="\${labelHeight}" rx="2" fill="\${labelColor}" fill-opacity=".72"/>\`).join("")}
      </g>
      \${Number.isFinite(tackX) ? \`<line x1="\${tackX}" y1="\${labelY-4}" x2="\${tackX}" y2="\${labelY+labelHeight+4}" stroke="\${model.tackMode === "leading" ? "#ffd05f" : "#fff"}" stroke-width="1.2" stroke-dasharray="3 3" opacity=".85" clip-path="url(#bottleClip-\${context.source})"/>\` : ""}
      <g transform="translate(\${cx+bodyHalf+13} \${hardwareY})" opacity="\${hardwareActive ? 1 : .32}">
        <circle cx="0" cy="0" r="13" fill="#1d252b" stroke="#788996" stroke-width="1.6"/>
        <circle cx="0" cy="0" r="4.5" fill="\${hardwareActive ? labelColor : "#52606a"}"/>
        <text x="0" y="24" text-anchor="middle" class="view-mini">\${escapeHtml(stationText)}</text>
      </g>
      <text x="145" y="245" text-anchor="middle" class="view-readout">\${escapeHtml(section.toUpperCase())} • \${model.tackMode === "leading" ? "LEADING EDGE" : "CENTER TACK"} • \${format(coverage.percentage, 0)}% wiped</text>
    </svg>\`;
  }

  function panelMarkup(source) {`;
source = source.replace(sideRegex, sideReplacement);

source = source.replace(
  "    clearLongNeckBottleV76: true\n",
  "    clearLongNeckBottleV76: true,\n    referenceBottleProfileV77: true,\n    cylindricalLabelProjectionV77: true,\n    leadingEdgeBodyBackVisualV77: true,\n    mainAnimationSyncV77: true\n"
);
write("app/bottle-orientation-panel-integration.js", source);

let animation = read("app/animation-runtime.js");
animation = replaceRequired(
  animation,
  `      renderAnimationFrame();\n    } catch (error) {`,
  `      renderAnimationFrame();\n      // Keep the Servo Program Bottle Orientation panel on the same clock as\n      // the primary labeler animation, even when the panel integration loaded\n      // before renderAnimationFrame was available to wrap.\n      window.LabelerBottleOrientationPanel?.renderAll?.();\n    } catch (error) {`,
  "main animation orientation sync"
);
write("app/animation-runtime.js", animation);

for (const path of ["app/bootstrap.js", "app/update-manager.js", "service-worker.js", "index.html", "tests/map-workspace-bottle-visual-v75.test.js", "tests/entry-exit-dead-zone-overlay.test.js"]) {
  let content = read(path);
  content = content.split(PREVIOUS).join(BUILD);
  write(path, content);
}

let bootstrap = read("app/bootstrap.js");
bootstrap = bootstrap.replace(/const buildUpdatedAt = "[^"]+";/, `const buildUpdatedAt = "${UPDATED}";`);
bootstrap = bootstrap.replace("// Regression lineage:", `// Regression lineage: ${BUILD} •`);
write("app/bootstrap.js", bootstrap);

const manifestPath = "update-manifest.json";
const manifest = JSON.parse(read(manifestPath));
manifest.buildId = BUILD;
manifest.notes = "Staging v77 refines Bottle Orientation to the requested clear long-neck bottle profile, projects labels as cylindrical wraps so they stay on the bottle while rotating, synchronizes the orientation visual with the main labeler animation, and makes Body/Back wipe progress visibly start from the leading edge while preserving Neck center-tack behavior unless configured otherwise.";
write(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

let test = read("tests/bottle-orientation-panel.test.js");
test = test.split(PREVIOUS).join(BUILD);
test = test.replace(
  "const serviceWorker = fs.readFileSync(path.join(root, \"service-worker.js\"), \"utf8\");",
  "const serviceWorker = fs.readFileSync(path.join(root, \"service-worker.js\"), \"utf8\");\nconst animationRuntime = fs.readFileSync(path.join(root, \"app/animation-runtime.js\"), \"utf8\");"
);
test = test.replace(
  "assert.match(source, /clearLongNeckBottleV76: true/);",
  `assert.match(source, /clearLongNeckBottleV76: true/);\nassert.match(source, /referenceBottleProfileV77: true/);\nassert.match(source, /cylindricalLabelProjectionV77: true/);\nassert.match(source, /leadingEdgeBodyBackVisualV77: true/);\nassert.match(source, /mainAnimationSyncV77: true/);\nassert.match(source, /projectLabelArcSegments/);\nassert.match(source, /data-wrapped-label=\\"true\\"/);\nassert.match(source, /section === \\"body\\" \\|\\| section === \\"back\\"/);\nassert.match(source, /coverage\\.tackMode = \\"leading\\"/);\nassert.match(source, /LEADING EDGE/);\nassert.match(animationRuntime, /LabelerBottleOrientationPanel\\?\\.renderAll\\?\\.\\(\\)/);`
);
test = test.replace("Full-cycle bottle orientation v76 regression passed.", "Reference bottle wrap + animation sync v77 regression passed.");
write("tests/bottle-orientation-panel.test.js", test);

console.log(`Applied ${BUILD}`);
