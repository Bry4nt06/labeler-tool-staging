"use strict";

(function installProgressiveBottleLabelFill(global) {
  if (global.LabelerProgressiveLabelFill?.progressiveBottleLabelFillV1) return;

  const bottleRenderer = global.LabelerBottleVisualRenderer;
  const baseTelemetry = global.LabelerWipeTelemetryService;
  const originalDrawTopViewBottle = global.drawTopViewBottle;
  if (!bottleRenderer || !baseTelemetry || typeof originalDrawTopViewBottle !== "function") return;

  const LABEL_SECTIONS = Object.freeze(["neck", "body", "back"]);

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function runtimeEls() {
    try { return els; }
    catch { return global.els || {}; }
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function normalizedApplicationReference(value) {
    const normalized = String(value || "").trim().toLowerCase().replace(/[_\s]+/g, "-");
    if (["center", "center-tack", "centre", "centre-tack"].includes(normalized)) return "center-tack";
    if (["leading", "leading-edge"].includes(normalized)) return "leading-edge";
    return null;
  }

  function wipeApplicationReference(section) {
    const normalizedSection = String(section || "").trim().toLowerCase();
    if (!LABEL_SECTIONS.includes(normalizedSection)) return "leading-edge";

    const currentState = runtimeState();
    const buildInputs = currentState?.buildInputs || {};
    const explicit = normalizedApplicationReference(buildInputs[`${normalizedSection}ApplicationReference`]);
    if (explicit) return explicit;

    // Preserve the original Neck application selector for older saved settings.
    if (normalizedSection === "neck") {
      return String(buildInputs.neckApplication || "").trim().toLowerCase() === "leading edge"
        ? "leading-edge"
        : "center-tack";
    }
    return "leading-edge";
  }

  function correctedWipeVisualApplication(section, labelLengthMm) {
    const currentState = runtimeState();
    const normalizedSection = String(section || "").trim().toLowerCase();
    const applicationReference = wipeApplicationReference(normalizedSection);
    const tackMode = applicationReference === "center-tack" ? "center" : "leading";
    const direction = currentState.direction === "cw" ? "ltr" : "rtl";
    const buildInputs = currentState.buildInputs || {};
    const numeric = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const backspinMm = normalizedSection === "neck"
      ? numeric(buildInputs.neckContactMm, 0)
      : normalizedSection === "body"
        ? numeric(buildInputs.bodyContactMm, 5)
        : normalizedSection === "back"
          ? numeric(buildInputs.backContactMm, 5)
          : 0;
    const length = Math.max(0, Number(labelLengthMm) || 0);
    const backspinPercent = length > 0 ? Math.max(0, Math.min(100, 100 * backspinMm / length)) : 0;
    return { tackMode, direction, backspinMm, backspinPercent, applicationReference };
  }

  // The Wipe-Down panel and the bottle overlay must resolve Body/Back Center Tack
  // from the same Build Input fields. Replacing the global function also updates
  // the classic-script binding used by wipeDownTelemetry().
  global.wipeApplicationReference = wipeApplicationReference;
  global.wipeVisualApplication = correctedWipeVisualApplication;
  global.LabelerWipeTelemetryService = Object.freeze({
    ...baseTelemetry,
    wipeApplicationReference,
    wipeVisualApplication: correctedWipeVisualApplication,
    applicationReferenceAwareV2: true
  });

  function arcPoint(angle, radius) {
    const radians = Number(angle) * Math.PI / 180;
    return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
  }

  function labelArcPath(startAngle, endAngle, radius) {
    const start = Number(startAngle);
    const end = Number(endAngle);
    const r = Math.max(0.1, Number(radius) || 1);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
    const span = Math.min(359.999, end - start);
    const first = arcPoint(start, r);
    const last = arcPoint(start + span, r);
    return `M ${first.x} ${first.y} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${last.x} ${last.y}`;
  }

  function labelProgressWindows(options = {}) {
    const centerDeg = Number(options.centerDeg) || 0;
    const arcWidthDeg = Math.min(330, Math.max(8, Number(options.arcWidthDeg) || 90));
    const half = arcWidthDeg / 2;
    const start = centerDeg - half;
    const end = centerDeg + half;
    const tackSpan = Math.min(4, Math.max(1.4, arcWidthDeg * 0.035));
    const empty = { primary: null, left: null, right: null, tack: null };
    if (!options.applied) return empty;

    if (options.tackMode === "center") {
      const leftSpan = half * clamp01((Number(options.leftPercent) || 0) / 100);
      const rightSpan = half * clamp01((Number(options.rightPercent) || 0) / 100);
      const hasCoverage = leftSpan > 0.001 || rightSpan > 0.001;
      return {
        primary: null,
        left: leftSpan > 0.001 ? [centerDeg - leftSpan, centerDeg] : null,
        right: rightSpan > 0.001 ? [centerDeg, centerDeg + rightSpan] : null,
        tack: hasCoverage ? null : [centerDeg - tackSpan / 2, centerDeg + tackSpan / 2]
      };
    }

    const fillSpan = arcWidthDeg * clamp01((Number(options.percentage) || 0) / 100);
    if (fillSpan <= 0.001) {
      return {
        ...empty,
        tack: options.direction === "rtl"
          ? [end - tackSpan, end]
          : [start, start + tackSpan]
      };
    }
    return {
      ...empty,
      primary: options.direction === "rtl"
        ? [end - fillSpan, end]
        : [start, start + fillSpan]
    };
  }

  function programForBottleGroup(bottleGroup, explicitProgram = null) {
    if (Array.isArray(explicitProgram)) return explicitProgram;
    const svg = bottleGroup?.ownerSVGElement;
    if (svg?.id === "simulationSvg" && typeof global.simulationProgram === "function") {
      return global.simulationProgram();
    }
    return typeof global.currentProgram === "function" ? global.currentProgram() : [];
  }

  function applicationPassed(tableAngle, applicationAngle) {
    if (typeof global.bottleHasPassedApplication === "function") {
      return global.bottleHasPassedApplication(tableAngle, applicationAngle);
    }
    const table = ((Number(tableAngle) % 360) + 360) % 360;
    const application = ((Number(applicationAngle) % 360) + 360) % 360;
    return table + 0.001 >= application;
  }

  function telemetryService() {
    return global.LabelerWipeTelemetryService || baseTelemetry;
  }

  function coverageForLabel(program, section, station, tableAngle, visual) {
    const service = telemetryService();
    const currentState = runtimeState();
    let objects = [];
    try { objects = service.wipeObjectsForSection(section, station) || []; }
    catch { objects = []; }

    // Non-APL applications and maps without wipe objects keep the historical
    // behavior: the label appears complete once its application station passes.
    if (String(currentState.applicationMode || "").toUpperCase() !== "APL" || !objects.length) {
      return { percentage: 100, leftPercent: 100, rightPercent: 100 };
    }

    try {
      return service.contactedLabelCoverage(program, section, station, Number(tableAngle), visual) || {};
    } catch {
      return { percentage: 0, leftPercent: 0, rightPercent: 0 };
    }
  }

  function setSectionVisibility(bottleGroup, section, visible) {
    bottleGroup.querySelectorAll(`[data-bottle-label-visibility="${section}"]`).forEach((node) => {
      node.setAttribute("display", visible ? "inline" : "none");
    });
  }

  function updateBottleLabelProgress(bottleGroup, tableAngle, explicitProgram = null) {
    if (!bottleGroup?.querySelectorAll) return;
    const program = programForBottleGroup(bottleGroup, explicitProgram);
    const service = telemetryService();

    LABEL_SECTIONS.forEach((section) => {
      const anchor = bottleGroup.querySelector(`[data-bottle-label-indicator="${section}"]`);
      const progressNodes = Array.from(bottleGroup.querySelectorAll(`[data-bottle-label-progress="${section}"]`));
      if (!anchor || !progressNodes.length) return;

      const applicationAngle = Number(anchor.getAttribute("data-application-angle"));
      const station = Number(anchor.getAttribute("data-application-station"));
      const applied = applicationPassed(tableAngle, applicationAngle);
      setSectionVisibility(bottleGroup, section, applied);
      progressNodes.forEach((node) => node.setAttribute("display", "none"));
      if (!applied) return;

      const centerDeg = Number(anchor.getAttribute("data-bottle-label-center-deg"));
      const arcWidthDeg = Number(anchor.getAttribute("data-bottle-label-arc-deg"));
      const radius = Number(anchor.getAttribute("data-bottle-label-radius"));
      const labelLengthMm = service.wipeLabelLengthMm(section);
      const visual = correctedWipeVisualApplication(section, labelLengthMm);
      const coverage = coverageForLabel(program, section, station, tableAngle, visual);
      const windows = labelProgressWindows({
        applied,
        tackMode: visual.tackMode,
        direction: visual.direction,
        centerDeg,
        arcWidthDeg,
        percentage: coverage.percentage,
        leftPercent: coverage.leftPercent,
        rightPercent: coverage.rightPercent
      });

      progressNodes.forEach((node) => {
        const part = node.getAttribute("data-progress-part");
        const range = windows[part];
        if (!range) return;
        const path = labelArcPath(range[0], range[1], radius);
        if (!path) return;
        node.setAttribute("d", path);
        node.setAttribute("display", "inline");
      });
    });
  }

  function decorateBottleLabelProgress(add, bottleGroup) {
    if (typeof add !== "function" || !bottleGroup?.querySelectorAll) return;
    bottleGroup.querySelectorAll("[data-bottle-label-indicator]").forEach((indicator) => {
      if (indicator.getAttribute("data-progressive-fill-decorated") === "true") return;
      const section = String(indicator.getAttribute("data-bottle-label-indicator") || "").toLowerCase();
      const visual = bottleRenderer.indicators?.[section];
      if (!visual) return;

      const arcWidthDeg = Number(indicator.getAttribute("data-bottle-label-arc-deg")) || 90;
      const radius = (Number(visual.innerRadius) + Number(visual.outerRadius)) / 2;
      const bandWidth = Math.max(0.4, Number(visual.outerRadius) - Number(visual.innerRadius));
      const applicationAngle = indicator.getAttribute("data-application-angle") || "0";
      const applicationStation = indicator.getAttribute("data-application-station") || "";

      indicator.setAttribute("data-progressive-fill-decorated", "true");
      indicator.setAttribute("data-bottle-label-footprint", section);
      indicator.setAttribute("data-bottle-label-center-deg", String(Number(visual.center) || 0));
      indicator.setAttribute("data-bottle-label-radius", String(radius));
      indicator.setAttribute("data-bottle-label-visibility", section);
      indicator.setAttribute("stroke-opacity", "0.22");

      const underlay = indicator.previousElementSibling;
      if (underlay?.tagName?.toLowerCase() === "path") {
        underlay.setAttribute("data-bottle-label-visibility", section);
        underlay.setAttribute("stroke-opacity", "0.58");
      }
      const highlight = indicator.nextElementSibling;
      if (highlight?.tagName?.toLowerCase() === "path") {
        highlight.setAttribute("data-bottle-label-visibility", section);
        highlight.setAttribute("stroke-opacity", "0.08");
      }

      ["primary", "left", "right", "tack"].forEach((part) => {
        add("path", {
          d: "",
          fill: "none",
          stroke: visual.color,
          "stroke-width": bandWidth,
          "stroke-opacity": 0.98,
          "stroke-linecap": "round",
          "data-bottle-label-progress": section,
          "data-progress-part": part,
          "data-bottle-label-center-deg": Number(visual.center) || 0,
          "data-bottle-label-radius": radius,
          "data-bottle-label-arc-deg": arcWidthDeg,
          "data-application-angle": applicationAngle,
          "data-application-station": applicationStation,
          "data-bottle-label-visibility": section,
          display: "none",
          "pointer-events": "none",
          "aria-hidden": "true"
        }, bottleGroup);
      });
    });
  }

  function drawTopViewBottleWithProgress(add, bottleGroup, tableAngle, ...rest) {
    const result = originalDrawTopViewBottle(add, bottleGroup, tableAngle, ...rest);
    decorateBottleLabelProgress(add, bottleGroup);
    updateBottleLabelProgress(bottleGroup, tableAngle);
    return result;
  }

  global.drawTopViewBottle = drawTopViewBottleWithProgress;
  global.LabelerBottleVisualRenderer = Object.freeze({
    ...bottleRenderer,
    drawTopViewBottle: drawTopViewBottleWithProgress,
    progressiveLabelFillV1: true
  });

  function refreshAnimatedBottleProgress(svg, program) {
    if (!svg?.querySelectorAll) return;
    let currentHeads = [];
    try { currentHeads = typeof heads === "function" ? heads() : []; }
    catch { currentHeads = typeof global.heads === "function" ? global.heads() : []; }
    svg.querySelectorAll("[data-animation-head]").forEach((node, index) => {
      const head = currentHeads[index];
      if (!head) return;
      updateBottleLabelProgress(node, head.tableAngle, program);
    });
  }

  function currentMapProgram() {
    try { return typeof currentProgram === "function" ? currentProgram() : []; }
    catch { return typeof global.currentProgram === "function" ? global.currentProgram() : []; }
  }

  function currentSimulationProgram() {
    try { return typeof simulationProgram === "function" ? simulationProgram() : []; }
    catch { return typeof global.simulationProgram === "function" ? global.simulationProgram() : []; }
  }

  const originalMapFrame = global.updateMapAnimationFrame;
  if (typeof originalMapFrame === "function") {
    global.updateMapAnimationFrame = function updateMapAnimationFrameWithLabelProgress(...args) {
      const result = originalMapFrame.apply(this, args);
      const currentEls = runtimeEls();
      refreshAnimatedBottleProgress(currentEls.mapSvg, currentMapProgram());
      return result;
    };
  }

  const originalSimulationFrame = global.updateSimulationAnimationFrame;
  if (typeof originalSimulationFrame === "function") {
    global.updateSimulationAnimationFrame = function updateSimulationAnimationFrameWithLabelProgress(...args) {
      const result = originalSimulationFrame.apply(this, args);
      const currentEls = runtimeEls();
      const svg = currentEls.simulation?.querySelector?.("#simulationSvg") || null;
      refreshAnimatedBottleProgress(svg, currentSimulationProgram());
      return result;
    };
  }

  if (global.LabelerMapAnimationRenderer) {
    global.LabelerMapAnimationRenderer = Object.freeze({
      ...global.LabelerMapAnimationRenderer,
      updateMapAnimationFrame: global.updateMapAnimationFrame,
      updateSimulationAnimationFrame: global.updateSimulationAnimationFrame,
      progressiveBottleLabelFillV1: true
    });
  }

  global.updateBottleLabelProgress = updateBottleLabelProgress;
  global.LabelerProgressiveLabelFill = Object.freeze({
    wipeApplicationReference,
    wipeVisualApplication: correctedWipeVisualApplication,
    labelArcPath,
    labelProgressWindows,
    decorateBottleLabelProgress,
    updateBottleLabelProgress,
    progressiveBottleLabelFillV1: true,
    leadingEdgeFillV1: true,
    centerTackFillV1: true
  });
})(window);
