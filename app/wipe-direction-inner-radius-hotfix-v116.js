"use strict";

(function installWipeDirectionInnerRadiusHotfix(global) {
  const BUILD_ID = "wipe-direction-inner-radius-v116-20260814-1800";
  if (global.ServoForgeWipeDirectionInnerRadiusHotfix?.buildId === BUILD_ID) return;

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function runtimeEls() {
    try { return els; }
    catch { return global.els || {}; }
  }

  function numeric(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function physicalMachineDirection() {
    const service = global.LabelerWipeTelemetryService;
    if (typeof service?.liveWipeMachineDirection === "function") {
      const live = String(service.liveWipeMachineDirection() || "").toLowerCase();
      if (live === "cw" || live === "ccw") return live;
    }

    const currentState = runtimeState();
    const stored = String(currentState.direction || "").toLowerCase() === "cw" ? "cw" : "ccw";
    if (typeof service?.physicalWipeMachineDirection === "function") {
      return service.physicalWipeMachineDirection(stored);
    }
    return stored === "cw" ? "ccw" : "cw";
  }

  function applicationReference(section) {
    const normalizedSection = String(section || "").trim().toLowerCase();
    const progressive = global.LabelerProgressiveLabelFill;
    if (typeof progressive?.wipeApplicationReference === "function") {
      return progressive.wipeApplicationReference(normalizedSection);
    }

    const currentState = runtimeState();
    const buildInputs = currentState.buildInputs || {};
    const explicit = String(buildInputs[`${normalizedSection}ApplicationReference`] || "").trim().toLowerCase();
    if (explicit.includes("center")) return "center-tack";
    if (explicit.includes("leading")) return "leading-edge";
    if (normalizedSection === "neck") {
      return String(buildInputs.neckApplication || "").trim().toLowerCase() === "leading edge"
        ? "leading-edge"
        : "center-tack";
    }
    return "leading-edge";
  }

  function physicalWipeVisualApplication(section, labelLengthMm) {
    const normalizedSection = String(section || "").trim().toLowerCase();
    const currentState = runtimeState();
    const buildInputs = currentState.buildInputs || {};
    const reference = applicationReference(normalizedSection);
    const tackMode = reference === "center-tack" ? "center" : "leading";
    const direction = physicalMachineDirection() === "cw" ? "ltr" : "rtl";
    const backspinMm = normalizedSection === "neck"
      ? numeric(buildInputs.neckContactMm, 0)
      : normalizedSection === "body"
        ? numeric(buildInputs.bodyContactMm, 5)
        : normalizedSection === "back"
          ? numeric(buildInputs.backContactMm, 5)
          : 0;
    const length = Math.max(0, numeric(labelLengthMm, 0));
    const backspinPercent = length > 0
      ? Math.max(0, Math.min(100, 100 * backspinMm / length))
      : 0;
    return { tackMode, direction, backspinMm, backspinPercent, applicationReference: reference };
  }

  // Progressive fill v47 reintroduced the legacy stored direction by assigning
  // its raw state.direction implementation to the global wipeVisualApplication
  // binding. Restore the physical-machine direction resolver after all feature
  // integrations have loaded. wipeDownTelemetry() resolves this global binding
  // at runtime, so the Label Wipe-Down panel immediately follows the real CW/CCW.
  global.wipeVisualApplication = physicalWipeVisualApplication;
  if (global.LabelerWipeTelemetryService) {
    global.LabelerWipeTelemetryService = Object.freeze({
      ...global.LabelerWipeTelemetryService,
      wipeVisualApplication: physicalWipeVisualApplication,
      physicalDirectionHotfixV116: true
    });
  }
  if (global.LabelerProgressiveLabelFill) {
    global.LabelerProgressiveLabelFill = Object.freeze({
      ...global.LabelerProgressiveLabelFill,
      wipeVisualApplication: physicalWipeVisualApplication,
      physicalDirectionHotfixV116: true
    });
  }

  // The progressive bottle-label renderer still closes over the v47 raw
  // direction helper. Run only that label-progress update in the physical
  // direction frame, then restore the persisted legacy coordinate token.
  const originalBottleProgress = global.updateBottleLabelProgress;
  if (typeof originalBottleProgress === "function") {
    global.updateBottleLabelProgress = function updateBottleLabelProgressPhysicalDirection(...args) {
      const currentState = runtimeState();
      const storedDirection = currentState.direction;
      currentState.direction = physicalMachineDirection();
      try {
        return originalBottleProgress.apply(this, args);
      } finally {
        currentState.direction = storedDirection;
      }
    };
  }

  function currentHeads() {
    try { return typeof heads === "function" ? heads() : []; }
    catch { return typeof global.heads === "function" ? global.heads() : []; }
  }

  function currentProgramRows() {
    try { return typeof currentProgram === "function" ? currentProgram() : []; }
    catch { return typeof global.currentProgram === "function" ? global.currentProgram() : []; }
  }

  function currentSimulationRows() {
    try { return typeof simulationProgram === "function" ? simulationProgram() : []; }
    catch { return typeof global.simulationProgram === "function" ? global.simulationProgram() : []; }
  }

  function refreshBottleProgress(svg, program) {
    if (!svg?.querySelectorAll || typeof global.updateBottleLabelProgress !== "function") return;
    const activeHeads = currentHeads();
    svg.querySelectorAll("[data-animation-head]").forEach((node, index) => {
      const head = activeHeads[index];
      if (!head) return;
      global.updateBottleLabelProgress(node, head.tableAngle, program);
    });
  }

  const originalMapFrame = global.updateMapAnimationFrame;
  if (typeof originalMapFrame === "function") {
    global.updateMapAnimationFrame = function updateMapAnimationFramePhysicalWipe(...args) {
      const result = originalMapFrame.apply(this, args);
      refreshBottleProgress(runtimeEls().mapSvg, currentProgramRows());
      return result;
    };
  }

  const originalSimulationFrame = global.updateSimulationAnimationFrame;
  if (typeof originalSimulationFrame === "function") {
    global.updateSimulationAnimationFrame = function updateSimulationAnimationFramePhysicalWipe(...args) {
      const result = originalSimulationFrame.apply(this, args);
      const simulationSvg = runtimeEls().simulation?.querySelector?.("#simulationSvg") || null;
      refreshBottleProgress(simulationSvg, currentSimulationRows());
      return result;
    };
  }

  function normalizeAplInsideWipeDepth() {
    const currentState = runtimeState();
    if (String(currentState.applicationMode || "").toLowerCase() === "cold-glue") return false;
    if (!currentState.depths) return false;
    const rawDepth = Number(currentState.depths.wipeInner);
    if (!Number.isFinite(rawDepth)) return false;
    const outsideDepth = Math.abs(rawDepth);
    if (outsideDepth === rawDepth) return false;
    currentState.depths.wipeInner = outsideDepth;
    return true;
  }

  // Inside/Outside describe the side of the wipe assembly, not a signed SVG
  // radius. APL wipe-down pads are physical hardware outside the servo-table
  // pitch circle. Normalize legacy negative inside-wipe depth to a positive
  // radial distance before each assembly render. Rollers keep their independent
  // signed nonOpRoller depth and are intentionally unaffected.
  normalizeAplInsideWipeDepth();
  const originalDrawConfiguredAssemblies = global.drawConfiguredAssemblies;
  if (typeof originalDrawConfiguredAssemblies === "function") {
    const wrappedDrawConfiguredAssemblies = function drawConfiguredAssembliesOutsideWipeRadius(...args) {
      normalizeAplInsideWipeDepth();
      return originalDrawConfiguredAssemblies.apply(this, args);
    };
    wrappedDrawConfiguredAssemblies.servoForgeInsideWipeOutsideRadiusV116 = true;
    global.drawConfiguredAssemblies = wrappedDrawConfiguredAssemblies;
  }

  global.SERVOFORGE_BUILD_ID = BUILD_ID;
  global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 14, 2026 6:00 PM ET";
  const banner = global.document?.querySelector?.(".staging-environment-banner");
  if (banner) {
    const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
    banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 14, 2026 6:00 PM ET — NOT PRODUCTION`;
  }

  global.ServoForgeWipeDirectionInnerRadiusHotfix = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    physicalMachineDirection,
    physicalWipeVisualApplication,
    normalizeAplInsideWipeDepth,
    physicalWipeDirectionV116: true,
    progressiveFillPhysicalDirectionV116: true,
    insideWipeOutsideRadiusV116: true
  });
})(window);
