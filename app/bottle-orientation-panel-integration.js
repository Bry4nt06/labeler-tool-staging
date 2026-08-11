"use strict";

(function installBottleOrientationPanel(global) {
  if (global.LabelerBottleOrientationPanel?.installed) return;

  const VERSION = 9;
  const STYLE_ID = "servoforge-bottle-orientation-panel-style";
  const PANEL_ATTR = "data-bottle-orientation-panel";
  const BASE_DEG_PER_SECOND = 18;
  const SECTION_COLORS = Object.freeze({
    neck: "#ff8a32",
    body: "#4ca8ff",
    back: "#71d34f"
  });
  const playback = {
    source: "program",
    playing: false,
    speed: 1,
    raf: null,
    lastTime: null
  };

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch {
      // Fall through to a Window property only if the lexical binding is unavailable.
    }
    return global.state || null;
  }

  function finite(value, fallback = NaN) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function normalizeAngle(value) {
    const angle = finite(value, 0) % 360;
    return angle < 0 ? angle + 360 : angle;
  }

  function format(value, digits = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric.toFixed(digits).replace(/\.0$/, "") : "--";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function activeMap() {
    try {
      return typeof activeMachineMap === "function" ? activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function generatedProgram() {
    const current = runtimeState();
    return Array.isArray(current?.program) ? current.program : [];
  }

  function programForSource(source) {
    const current = runtimeState();
    if (source === "simulation" && current?.simulation?.useCustom) {
      try {
        const custom = typeof simulationProgram === "function" ? simulationProgram() : null;
        if (Array.isArray(custom) && custom.length) return custom;
      } catch {
        // Fall back to the generated program.
      }
    }
    return generatedProgram();
  }

  function programSegmentsFor(program) {
    try {
      return typeof programSegments === "function" ? programSegments(program) : [];
    } catch {
      return [];
    }
  }

  function stationOneSection() {
    try {
      const resolved = typeof labelSectionForStation === "function" ? labelSectionForStation(1) : null;
      if (["neck", "body", "back"].includes(resolved)) return resolved;
    } catch {
      // Use the explicit map assignment when the runtime resolver is unavailable.
    }
    const explicit = String(activeMap()?.stationSections?.["1"] || "").toLowerCase();
    return ["neck", "body", "back"].includes(explicit) ? explicit : "neck";
  }

  function stationOneObjects() {
    return (Array.isArray(activeMap()?.objects) ? activeMap().objects : []).filter((item) => {
      const kind = String(item?.kind || "");
      return Number(item?.station) === 1
        && ["roller", "pad", "brush", "brush-channel", "wipe", "sensor"].includes(kind);
    });
  }

  function objectStart(item) {
    if (item?.kind === "brush-channel") return Math.min(
      finite(item?.outerStart, Infinity),
      finite(item?.innerStart, Infinity)
    );
    return finite(item?.angle, finite(item?.start, NaN));
  }

  function objectEnd(item) {
    const point = finite(item?.angle, NaN);
    if (Number.isFinite(point)) return point + 2;
    const start = finite(item?.start, NaN);
    if (item?.kind === "roller" && Number.isFinite(start)) {
      return start + Math.max(0.1, finite(item?.wipeSpanDeg, 5));
    }
    if (item?.kind === "brush-channel") return Math.max(
      finite(item?.outerEnd, -Infinity),
      finite(item?.innerEnd, -Infinity)
    );
    return finite(item?.end, start);
  }

  function unwrapAtOrAfter(value, reference) {
    let resolved = finite(value, NaN);
    if (!Number.isFinite(resolved)) return NaN;
    while (resolved < reference - 0.001) resolved += 360;
    while (resolved >= reference + 360) resolved -= 360;
    if (resolved < reference - 0.001) resolved += 360;
    return resolved;
  }

  function stationOnePath(program) {
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
  }

  function currentUnwrappedAngle(path) {
    const current = runtimeState();
    const normalized = normalizeAngle(current?.previewAngle);
    const midpoint = (path.start + path.end) / 2;
    const candidates = [normalized - 360, normalized, normalized + 360, normalized + 720];
    const closest = candidates.reduce((best, candidate) => (
      Math.abs(candidate - midpoint) < Math.abs(best - midpoint) ? candidate : best
    ), candidates[0]);
    return clamp(closest, path.start, path.end);
  }

  function selectedLabel() {
    try {
      return typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    } catch {
      return null;
    }
  }

  function selectedBottle() {
    try {
      return typeof selectedBottleSpec === "function" ? selectedBottleSpec() : null;
    } catch {
      return null;
    }
  }

  function labelLengthMm(section, label) {
    const service = global.LabelerWipeTelemetryService;
    if (typeof service?.wipeLabelLengthMm === "function") {
      const measured = finite(service.wipeLabelLengthMm(section, label), NaN);
      if (Number.isFinite(measured) && measured > 0) return measured;
    }
    if (section === "neck") return Math.max(finite(label?.neckBottomCurveMm, 0), finite(label?.neckLengthMm, 0));
    if (section === "body") return finite(label?.bodyLengthMm, 0);
    if (section === "back") return finite(label?.backLengthMm, 0);
    return 0;
  }

  function bodyCircumferenceMm(bottle) {
    try {
      const measured = typeof bodyCircumference === "function" ? finite(bodyCircumference(bottle), NaN) : NaN;
      if (Number.isFinite(measured) && measured > 0) return measured;
    } catch {
      // Calculate from the selected bottle diameter below.
    }
    const diameter = Math.max(1, finite(bottle?.diameterTargetMm, finite(bottle?.bodyBackDiameterMm, 60)));
    return Math.PI * diameter;
  }

  function labelGeometry(section) {
    const label = selectedLabel();
    const bottle = selectedBottle();
    const bodyCirc = bodyCircumferenceMm(bottle);
    const neckCirc = Math.max(1, finite(label?.neckBottomCircumferenceMm, bodyCirc * 0.56));
    const circumference = section === "neck" ? neckCirc : bodyCirc;
    const lengthMm = labelLengthMm(section, label);
    let labelDeg = NaN;
    try {
      labelDeg = typeof degFromMm === "function" ? finite(degFromMm(lengthMm, circumference), NaN) : NaN;
    } catch {
      // Use the shared bottle renderer fallback below.
    }
    if (!Number.isFinite(labelDeg) || labelDeg <= 0) {
      labelDeg = finite(global.LabelerBottleVisualRenderer?.bottleLabelArcWidthDeg?.(section), 90);
    }
    return {
      label,
      bottle,
      bodyCirc,
      neckCirc,
      circumference,
      lengthMm,
      labelDeg: clamp(labelDeg, 1, 350),
      bottleDiameterMm: Math.max(1, finite(bottle?.diameterTargetMm, bodyCirc / Math.PI))
    };
  }

  function bottleAngleAtTable(tableAngle, program) {
    try {
      return typeof plateAngleAt === "function" ? finite(plateAngleAt(normalizeAngle(tableAngle), program), 0) : 0;
    } catch {
      return 0;
    }
  }

  function activeRowAt(tableAngle, program) {
    try {
      return typeof activeSegmentForProgram === "function"
        ? activeSegmentForProgram(program, normalizeAngle(tableAngle))
        : null;
    } catch {
      return null;
    }
  }

  function stationOneCoverage(program, section, tableAngle, geometry) {
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
  }

  function currentHardware(tableAngle) {
    try {
      const context = global.LabelerWipeTelemetryService?.wipeStationContextAtAngle?.(normalizeAngle(tableAngle));
      return context?.object || null;
    } catch {
      return null;
    }
  }

  function contextFor(source) {
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
    const rawCoverage = telemetry?.section === section
      ? telemetry
      : stationOneCoverage(program, section, tableAngle, geometry);
    let applicationVisual = null;
    try { applicationVisual = service?.wipeVisualApplication?.(section, geometry.lengthMm) || null; } catch { applicationVisual = null; }
    const coverage = { ...(applicationVisual || {}), ...(rawCoverage || {}) };
    // Body and Back are physically leading-edge applications in ServoForge.
    // Preserve Neck center-tack behavior unless the Neck application itself is
    // configured as Leading Edge. This is a presentation correction only; the
    // generated servo program and wipe telemetry remain authoritative.
    if (section === "body" || section === "back") coverage.tackMode = "leading";
    if (!coverage.direction) coverage.direction = runtimeState()?.direction === "cw" ? "ltr" : "rtl";
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
  }

  function polarPoint(angleDeg, radius, cx = 0, cy = 0) {
    const radians = angleDeg * Math.PI / 180;
    // Bottle-local 0° uses the same +X/right-hand front reference as the
    // Mechanical Map bottle renderer. Positive SVG angle is clockwise; the
    // machineVisualAngle sign below makes servo rotation oppose carousel travel.
    return {
      x: cx + Math.cos(radians) * radius,
      y: cy + Math.sin(radians) * radius
    };
  }

  function arcPath(centerX, centerY, radius, startDeg, endDeg) {
    let span = endDeg - startDeg;
    while (span < 0) span += 360;
    span = Math.min(359.9, span);
    const start = polarPoint(startDeg, radius, centerX, centerY);
    const end = polarPoint(startDeg + span, radius, centerX, centerY);
    return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius} ${radius} 0 ${span > 180 ? 1 : 0} 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`;
  }

  function machineVisualAngle(angleDeg) {
    const angle = finite(angleDeg, 0);
    return String(runtimeState()?.direction || "cw").toLowerCase() === "cw" ? -angle : angle;
  }

  function tableFrameVisualAngle(tableAngle) {
    // Use the exact table/head transform used by the live Mechanical Map.
    // This makes the Top View a magnified world-frame view of servo/head 1,
    // rather than a bottle-only compass that ignores where the head is on the table.
    try {
      if (typeof angleToSvgRotation === "function") {
        const mapped = finite(angleToSvgRotation(normalizeAngle(tableAngle)), NaN);
        if (Number.isFinite(mapped)) return mapped;
      }
    } catch {
      // Mirror geometry-primitives.js below if the shared helper is unavailable.
    }
    const current = runtimeState();
    const direction = String(current?.direction || "cw").toLowerCase();
    const signed = direction === "cw" ? -1 : 1;
    const zeroBase = direction === "cw" ? 180 : 0;
    return normalizeAngle(zeroBase + finite(current?.zeroAngle, 0) + signed * finite(tableAngle, 0));
  }

  function headOneWorldVisualAngle(tableAngle, plateAngle) {
    // Mechanical Map parity:
    // angleToSvgRotation(head.tableAngle) + servoSign * bottlePreviewAngle(head)
    return tableFrameVisualAngle(tableAngle) + machineVisualAngle(plateAngle);
  }

  function labelArcModel(context) {
    const { section, plateAngle, geometry, coverage } = context;
    const visualPlateAngle = machineVisualAngle(plateAngle);
    const baseCenter = section === "back" ? machineVisualAngle(180) : 0;
    const center = baseCenter + visualPlateAngle;
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

  function topViewSvg(context) {
    const { section, plateAngle, geometry, coverage } = context;
    const bodyRadius = 66;
    const neckRadius = clamp(bodyRadius * geometry.neckCirc / geometry.bodyCirc, 25, 49);
    const labelRadius = section === "neck" ? neckRadius : bodyRadius;
    const labelColor = SECTION_COLORS[section] || "#4ca8ff";
    const localModel = labelArcModel(context);
    const tableFrameAngle = tableFrameVisualAngle(context.tableAngle);
    // Rotate the complete bottle-local label model into the same world frame as
    // servo/head 1 on the Mechanical Map. Local servo rotation remains layered
    // on top through labelArcModel(), exactly like the live bottle-table group.
    const model = {
      ...localModel,
      center: localModel.center + tableFrameAngle,
      start: localModel.start + tableFrameAngle,
      end: localModel.end + tableFrameAngle,
      leadingEdge: localModel.leadingEdge + tableFrameAngle,
      wipeRanges: localModel.wipeRanges.map(([start, end]) => [start + tableFrameAngle, end + tableFrameAngle])
    };
    const visualPlateAngle = headOneWorldVisualAngle(context.tableAngle, plateAngle);
    const front = polarPoint(visualPlateAngle, bodyRadius - 5);
    const labelCenterPoint = polarPoint(model.center, labelRadius - 5);
    const hardwareActive = Boolean(context.hardware) || finite(coverage.percentage, 0) > 0;
    const fullArc = arcPath(0, 4, labelRadius, model.start, model.end);
    const wipedArcs = model.wipeRanges.map(([start, end]) => arcPath(0, 4, labelRadius, start, end));
    const tackPoint = polarPoint(model.tackMode === "leading" ? model.leadingEdge : model.center, labelRadius, 0, 4);

    return `<svg class="bottle-orientation-svg" data-top-view-frame="head-1-world" viewBox="-145 -126 290 252" role="img" aria-label="Top-down head 1 bottle orientation at table ${format(context.tableAngle, 1)} degrees and bottle ${format(plateAngle, 1)} degrees">
      <defs>
        <radialGradient id="bottleTopGlass-${context.source}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#5b3828"/><stop offset="0.55" stop-color="#271b17"/><stop offset="1" stop-color="#0b0f13"/></radialGradient>
      </defs>
      <circle cx="0" cy="4" r="84" fill="#070c11" stroke="#6e7780" stroke-width="2"/>
      <circle cx="0" cy="4" r="77" fill="none" stroke="#b4bcc4" stroke-opacity=".35" stroke-width="1"/>
      ${[0,90,180,270].map((degree) => {
        const markerAngle = tableFrameAngle + machineVisualAngle(degree);
        const inner = polarPoint(markerAngle, 83, 0, 4);
        const outer = polarPoint(markerAngle, 94, 0, 4);
        const text = polarPoint(markerAngle, 108, 0, 4);
        return `<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="#ff5b3d" stroke-width="2"/><text x="${text.x}" y="${text.y + 4}" text-anchor="middle" class="degree-label">${degree}°</text>`;
      }).join("")}
      <circle cx="0" cy="4" r="${bodyRadius}" fill="url(#bottleTopGlass-${context.source})" stroke="#a07155" stroke-width="2"/>
      <circle cx="0" cy="4" r="${neckRadius}" fill="#171313" stroke="#76503d" stroke-width="1.2"/>
      <circle cx="0" cy="4" r="11" fill="#2188d8" stroke="#a8ddff" stroke-width="1.2"/>
      <path d="${fullArc}" fill="none" stroke="#397ea9" stroke-opacity="${context.applicationStarted ? .46 : .18}" stroke-width="${section === "neck" ? 10 : 13}" stroke-linecap="round"/>
      ${wipedArcs.map((path) => `<path d="${path}" fill="none" stroke="${labelColor}" stroke-width="${section === "neck" ? 10 : 13}" stroke-linecap="round"/>`).join("")}
      <line x1="0" y1="4" x2="${front.x}" y2="${front.y + 4}" stroke="#ff4d3a" stroke-width="2.3" stroke-dasharray="5 4"/>
      <circle cx="${labelCenterPoint.x}" cy="${labelCenterPoint.y + 4}" r="2.8" fill="#fff" stroke="${labelColor}" stroke-width="1.2"/>
      <circle cx="${tackPoint.x}" cy="${tackPoint.y}" r="3.2" fill="${model.tackMode === "leading" ? "#ffd05f" : "#ffffff"}" stroke="#091017" stroke-width="1"/>
      <text x="0" y="-106" text-anchor="middle" class="view-title">TOP VIEW</text>
      <text x="0" y="116" text-anchor="middle" class="view-readout">Bottle ${format(plateAngle, 1)}° • ${model.tackMode === "leading" ? "Leading edge" : "Center tack"}</text>
    </svg>`;
  }

  function panelMarkup(source) {
    return `<details class="bottle-orientation-panel" ${PANEL_ATTR}="${source}" open>
      <summary>
        <span><strong>Bottle Orientation</strong><small>Full servo cycle • synchronized to labeler animation</small></span>
        <span class="bottle-orientation-live-badge">LIVE</span>
      </summary>
      <div class="bottle-orientation-content">
        <div class="bottle-orientation-metrics">
          <div><span>Table</span><strong data-orientation-table>--</strong></div>
          <div><span>Bottle</span><strong data-orientation-bottle>--</strong></div>
          <div><span>HMI / CMD</span><strong data-orientation-command>--</strong></div>
          <div><span>Station / label</span><strong data-orientation-section>--</strong></div>
          <div><span>Wipe</span><strong data-orientation-wipe>0%</strong></div>
          <div><span>Contact</span><strong data-orientation-contact>Waiting</strong></div>
        </div>
        <div class="bottle-orientation-visual-grid">
          <div class="bottle-orientation-view" data-orientation-top></div>
        </div>
        <div class="bottle-orientation-action" data-orientation-action>Waiting for servo program data.</div>
        <p class="bottle-orientation-note">Top View follows the same table-frame and servo-angle transforms as the live Mechanical Map and stays synchronized to the main labeler animation.</p>
      </div>
    </details>`;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .bottle-orientation-panel{margin:0 0 10px;border:1px solid var(--line);border-radius:10px;background:linear-gradient(180deg,rgba(20,28,35,.96),rgba(10,16,21,.98));overflow:hidden;}
      .bottle-orientation-panel>summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;cursor:pointer;list-style:none;border-bottom:1px solid transparent;}
      .bottle-orientation-panel[open]>summary{border-bottom-color:var(--line);}
      .bottle-orientation-panel>summary::-webkit-details-marker{display:none;}
      .bottle-orientation-panel>summary span:first-child{display:grid;gap:2px;}
      .bottle-orientation-panel>summary strong{font-size:12px;}
      .bottle-orientation-panel>summary small{color:var(--muted);font-size:8px;}
      .bottle-orientation-live-badge{display:inline-flex;align-items:center;justify-content:center;min-width:38px;padding:3px 7px;border:1px solid #ff6a3d;border-radius:999px;color:#ff9a77;font-size:8px;font-weight:900;letter-spacing:.08em;}
      .bottle-orientation-content{padding:9px;}
      .bottle-orientation-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin-bottom:7px;}
      .bottle-orientation-metrics>div{min-width:0;padding:5px 6px;border:1px solid var(--line);border-radius:6px;background:var(--input);}
      .bottle-orientation-metrics span,.bottle-orientation-metrics strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
      .bottle-orientation-metrics span{color:var(--muted);font-size:7px;text-transform:uppercase;letter-spacing:.04em;}
      .bottle-orientation-metrics strong{margin-top:2px;font-size:9px;}
      .bottle-orientation-visual-grid{display:grid;grid-template-columns:minmax(0,560px);justify-content:center;gap:7px;}
      .bottle-orientation-view{min-width:0;min-height:310px;border:1px solid var(--line);border-radius:8px;background:radial-gradient(circle at 50% 35%,rgba(37,49,59,.72),rgba(6,10,14,.98) 72%);overflow:hidden;}
      .bottle-orientation-svg{display:block;width:100%;height:315px;}
      .bottle-orientation-svg text{fill:#dbe6ed;font-family:inherit;}
      .bottle-orientation-svg .view-title{font-size:10px;font-weight:800;letter-spacing:.12em;fill:#f2f6f8;}
      .bottle-orientation-svg .degree-label{font-size:8px;font-weight:800;fill:#ff8866;}
      .bottle-orientation-svg .view-readout{font-size:8px;font-weight:700;fill:#c6d3da;}
      .bottle-orientation-svg .hardware-label{font-size:6px;font-weight:900;fill:#ffd8ca;letter-spacing:.06em;}
      .bottle-orientation-action{margin:7px 0 6px;padding:5px 7px;border-left:3px solid #ff6a3d;border-radius:4px;background:rgba(255,106,61,.08);color:#dfe8ed;font-size:9px;line-height:1.25;}
      .bottle-orientation-note{margin:6px 1px 0;color:var(--muted);font-size:7.5px;line-height:1.3;}
      @media(max-width:900px){.bottle-orientation-metrics{grid-template-columns:repeat(3,minmax(0,1fr));}.bottle-orientation-visual-grid{grid-template-columns:1fr;}.bottle-orientation-view{min-height:210px;}.bottle-orientation-svg{height:220px;}}
      @media(max-width:620px){.bottle-orientation-metrics{grid-template-columns:repeat(2,minmax(0,1fr));}.bottle-orientation-controls{grid-template-columns:repeat(4,1fr);}.bottle-orientation-speed{grid-column:1/-1;}.bottle-orientation-scrubber{grid-template-columns:1fr;}.bottle-orientation-scrubber output{text-align:left;}}
    `;
    document.head.appendChild(style);
  }

  function panelHost(source) {
    return document.getElementById(source === "simulation" ? "simulation" : "program");
  }

  function ensurePanel(source) {
    const host = panelHost(source);
    if (!host) return null;
    let panel = host.querySelector(`[${PANEL_ATTR}="${source}"]`);
    if (panel) return panel;
    host.insertAdjacentHTML("afterbegin", panelMarkup(source));
    panel = host.querySelector(`[${PANEL_ATTR}="${source}"]`);
    if (!panel) return null;
    return panel;
  }

  function setText(panel, selector, value) {
    const node = panel?.querySelector(selector);
    if (node) node.textContent = value;
  }

  function renderSource(source) {
    ensureStyles();
    const panel = ensurePanel(source);
    if (!panel) return false;
    const context = contextFor(source);
    const top = panel.querySelector("[data-orientation-top]");
    if (top) top.innerHTML = topViewSvg(context);

    const command = context.active
      ? `HMI ${context.active.hmi ?? "--"} / CMD ${context.active.cmd ?? "--"}`
      : "--";
    setText(panel, "[data-orientation-table]", `${format(context.tableAngle, 1)}°`);
    setText(panel, "[data-orientation-bottle]", `${format(context.plateAngle, 1)}°`);
    setText(panel, "[data-orientation-command]", command);
    setText(panel, "[data-orientation-section]", `${context.station ? `S${context.station} • ` : ""}${context.section[0].toUpperCase()}${context.section.slice(1)} • ${format(context.geometry.labelDeg, 1)}°`);
    setText(panel, "[data-orientation-wipe]", `${format(context.coverage.percentage, 0)}%`);
    setText(panel, "[data-orientation-contact]", context.hardware?.name || (context.hardware?.kind ? context.hardware.kind : "Waiting"));
    setText(panel, "[data-orientation-action]", context.active?.action || "Waiting for servo program data.");
    setText(panel, "[data-orientation-path-readout]", `${format(context.path.start, 1)}° → ${format(context.path.end, 1)}°`);

    const scrubber = panel.querySelector("[data-orientation-scrubber]");
    if (scrubber) {
      scrubber.min = String(context.path.start);
      scrubber.max = String(context.path.end);
      scrubber.value = String(context.tableAngle);
    }
    const speed = panel.querySelector("[data-orientation-speed]");
    if (speed && Number(speed.value) !== playback.speed) speed.value = String(playback.speed);
    const playButton = panel.querySelector('[data-orientation-action-button="play"]');
    const thisPlaying = playback.playing && playback.source === source;
    if (playButton) {
      playButton.textContent = thisPlaying ? "Pause Full Cycle" : "Play Full Cycle";
      playButton.setAttribute("aria-pressed", thisPlaying ? "true" : "false");
    }
    return true;
  }

  function renderAll() {
    ["program", "simulation"].forEach((source) => {
      if (panelHost(source)) renderSource(source);
    });
  }

  function stopPlayback() {
    playback.playing = false;
    playback.lastTime = null;
    if (playback.raf !== null) global.cancelAnimationFrame(playback.raf);
    playback.raf = null;
    renderAll();
  }

  function pauseGlobalAnimation() {
    const current = runtimeState();
    if (!current) return;
    current.isPlaying = false;
    if (typeof els !== "undefined" && els?.playPause) {
      els.playPause.textContent = "Play";
      els.playPause.setAttribute("aria-pressed", "false");
    }
  }

  function syncAnimationFrame() {
    if (typeof global.renderAnimationFrame === "function") {
      global.renderAnimationFrame();
      return;
    }
    global.updateMapAnimationFrame?.();
    global.updateSimulationAnimationFrame?.();
    renderAll();
  }

  function setPreview(source, value, { stop = true } = {}) {
    if (stop) stopPlayback();
    pauseGlobalAnimation();
    const current = runtimeState();
    if (!current) return;
    const context = contextFor(source);
    const next = clamp(finite(value, context.path.start), context.path.start, context.path.end);
    current.previewAngle = normalizeAngle(next);
    syncAnimationFrame();
  }

  function playbackTick(now) {
    if (!playback.playing) return;
    const host = panelHost(playback.source);
    if (!host?.classList.contains("active")) {
      stopPlayback();
      return;
    }
    const context = contextFor(playback.source);
    const elapsed = playback.lastTime === null ? 0 : Math.min(.05, Math.max(0, now - playback.lastTime) / 1000);
    playback.lastTime = now;
    let next = context.tableAngle + BASE_DEG_PER_SECOND * playback.speed * elapsed;
    if (next > context.path.end - .001) next = context.path.start;
    const current = runtimeState();
    if (current) current.previewAngle = normalizeAngle(next);
    syncAnimationFrame();
    playback.raf = global.requestAnimationFrame(playbackTick);
  }

  function startPlayback(source) {
    pauseGlobalAnimation();
    if (playback.raf !== null) global.cancelAnimationFrame(playback.raf);
    playback.source = source;
    playback.playing = true;
    playback.lastTime = null;
    const context = contextFor(source);
    const current = runtimeState();
    if (current && (context.tableAngle <= context.path.start + .001 || context.tableAngle >= context.path.end - .001)) {
      current.previewAngle = normalizeAngle(context.path.start);
    }
    renderAll();
    playback.raf = global.requestAnimationFrame(playbackTick);
  }

  function sourceFromPanel(panel) {
    return panel?.getAttribute(PANEL_ATTR) === "simulation" ? "simulation" : "program";
  }

  function onPanelClick(event) {
    const button = event.target.closest?.("[data-orientation-action-button]");
    if (!button) return;
    event.preventDefault();
    const panel = button.closest(`[${PANEL_ATTR}]`);
    const source = sourceFromPanel(panel);
    const action = button.dataset.orientationActionButton;
    const context = contextFor(source);
    if (action === "play") {
      if (playback.playing && playback.source === source) stopPlayback();
      else startPlayback(source);
      return;
    }
    if (action === "reset") setPreview(source, context.path.start);
    if (action === "step-back") setPreview(source, context.tableAngle - 1);
    if (action === "step-forward") setPreview(source, context.tableAngle + 1);
  }

  function onPanelInput(event) {
    const slider = event.target.closest?.("[data-orientation-scrubber]");
    if (!slider) return;
    const source = sourceFromPanel(slider.closest(`[${PANEL_ATTR}]`));
    setPreview(source, slider.value);
  }

  function onPanelChange(event) {
    const speed = event.target.closest?.("[data-orientation-speed]");
    if (!speed) return;
    playback.speed = clamp(finite(speed.value, 1), .25, 4);
    renderAll();
  }

  function wrapRenderer(name, source) {
    const base = global[name];
    if (typeof base !== "function" || base.stationOneBottleOrientationV72) return false;
    const wrapped = function renderWithStationOneBottleOrientation(...args) {
      const result = base.apply(this, args);
      renderSource(source);
      return result;
    };
    wrapped.stationOneBottleOrientationV72 = true;
    wrapped.previousRenderer = base;
    global[name] = wrapped;
    return true;
  }

  function wrapAnimationFrame() {
    const base = global.renderAnimationFrame;
    if (typeof base !== "function" || base.stationOneBottleOrientationV72) return false;
    const wrapped = function renderAnimationFrameWithBottleOrientation(...args) {
      const result = base.apply(this, args);
      renderAll();
      return result;
    };
    wrapped.stationOneBottleOrientationV72 = true;
    wrapped.previousRenderAnimationFrame = base;
    global.renderAnimationFrame = wrapped;
    return true;
  }

  ensureStyles();
  wrapRenderer("renderProgram", "program");
  wrapRenderer("renderSimulation", "simulation");
  wrapAnimationFrame();

  global.LabelerBottleOrientationPanel = Object.freeze({
    installed: true,
    version: VERSION,
    programForSource,
    stationOnePath,
    fullProgramPath: stationOnePath,
    contextFor,
    machineVisualAngle,
    tableFrameVisualAngle,
    headOneWorldVisualAngle,
    topViewSvg,
    sideViewSvg,
    ensurePanel,
    renderSource,
    renderAll,
    startPlayback,
    stopPlayback,
    setPreview,
    station1SharedVisualV72: true,
    programAccessibleWithoutSimulationV72: true,
    geometryDrivenLabelScaleV72: true,
    wipeTelemetryDrivenV72: true,
    fullCycleVisualV76: true,
    clearLongNeckBottleV76: true,
    referenceBottleProfileV77: true,
    cylindricalLabelProjectionV77: true,
    leadingEdgeBodyBackVisualV77: true,
    mainAnimationSyncV77: true,
    machineDirectionVisualV78: true,
    directionAwareDegreeMarkersV78: true,
    rightFrontZeroDatumV79: true,
    oppositeCarouselBottleSpinV79: true,
    headOneWorldFrameTopViewV80: true,
    mechanicalMapTransformParityV80: true,
    topViewOnlyV84: true,
    standaloneOrientationControlsRemovedV84: true,
    topViewWipeGraphicRemovedV84: true,
    mainAnimationOnlyV84: true,
  });
})(typeof window !== "undefined" ? window : globalThis);
