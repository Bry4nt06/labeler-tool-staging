"use strict";

(function installWipeInnerBottleSpinHotfix(global) {
  const BUILD_ID = "wipe-inner-bottle-spin-v117-20260814-2235";
  if (global.ServoForgeWipeInnerBottleSpinHotfix?.buildId === BUILD_ID) return;

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
    if (typeof global.LabelerCoderOrientationDriver?.physicalDirection === "function") {
      return global.LabelerCoderOrientationDriver.physicalDirection(stored);
    }
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

  // Keep the v116 wipe-progress correction: presentation follows the physical
  // CW/CCW label shown in Map Builder, while the persisted map token remains
  // untouched for compatibility with existing maps and servo/coder math.
  global.wipeVisualApplication = physicalWipeVisualApplication;
  if (global.LabelerWipeTelemetryService) {
    global.LabelerWipeTelemetryService = Object.freeze({
      ...global.LabelerWipeTelemetryService,
      wipeVisualApplication: physicalWipeVisualApplication,
      physicalDirectionHotfixV117: true
    });
  }
  if (global.LabelerProgressiveLabelFill) {
    global.LabelerProgressiveLabelFill = Object.freeze({
      ...global.LabelerProgressiveLabelFill,
      wipeVisualApplication: physicalWipeVisualApplication,
      physicalDirectionHotfixV117: true
    });
  }

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

  // Inside wipe-down pads are physically mounted on the inside of the bottle
  // path. Keep wipeInner signed inward. This also repairs maps that v116 may
  // have temporarily converted to a positive/outward depth. Inside rollers use
  // nonOpRoller and are intentionally not modified here.
  function normalizeAplInsideWipeDepth() {
    const currentState = runtimeState();
    if (String(currentState.applicationMode || "").toLowerCase() === "cold-glue") return false;
    if (!currentState.depths) return false;
    const rawDepth = Number(currentState.depths.wipeInner);
    if (!Number.isFinite(rawDepth)) return false;
    const insideDepth = rawDepth === 0 ? 0 : -Math.abs(rawDepth);
    if (Object.is(rawDepth, insideDepth) || rawDepth === insideDepth) return false;
    currentState.depths.wipeInner = insideDepth;
    return true;
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

  // Positive servo travel must be converted using the physical machine
  // direction, not the legacy stored map token. This sign matches the physical
  // wipe-contact model already used by wipeVisualSideForPlateTravel().
  function bottleVisualServoSign(machineDirection = physicalMachineDirection()) {
    return String(machineDirection || "").toLowerCase() === "cw" ? -1 : 1;
  }

  function correctBottleTransforms(svg, program) {
    if (!svg?.querySelectorAll) return 0;
    const activeHeads = currentHeads();
    const byNumber = new Map(activeHeads.map((head) => [String(head.head), head]));
    const visualSign = bottleVisualServoSign();
    const physicalDirection = physicalMachineDirection();
    let corrected = 0;

    svg.querySelectorAll("[data-animation-head]").forEach((node, index) => {
      const key = String(node.getAttribute?.("data-animation-head") || "");
      const head = byNumber.get(key) || activeHeads[index];
      if (!head) return;
      const padAngle = typeof global.bottlePreviewAngle === "function"
        ? numeric(global.bottlePreviewAngle(head, program), 0)
        : 0;
      const radialRotation = typeof global.angleToSvgRotation === "function"
        ? numeric(global.angleToSvgRotation(head.tableAngle), 0)
        : 0;
      const referenceRotation = radialRotation + visualSign * padAngle;
      node.setAttribute("transform", `translate(${head.x} ${head.y}) rotate(${referenceRotation})`);
      node.setAttribute("data-bottle-spin-direction", physicalDirection);
      node.setAttribute("data-bottle-servo-visual-sign", String(visualSign));
      corrected += 1;
    });
    return corrected;
  }

  function refreshBottleProgress(svg, program) {
    if (!svg?.querySelectorAll || typeof global.updateBottleLabelProgress !== "function") return 0;
    const activeHeads = currentHeads();
    const byNumber = new Map(activeHeads.map((head) => [String(head.head), head]));
    let refreshed = 0;
    svg.querySelectorAll("[data-animation-head]").forEach((node, index) => {
      const key = String(node.getAttribute?.("data-animation-head") || "");
      const head = byNumber.get(key) || activeHeads[index];
      if (!head) return;
      global.updateBottleLabelProgress(node, head.tableAngle, program);
      refreshed += 1;
    });
    return refreshed;
  }

  function postProcessMap(svg, program) {
    refreshBottleProgress(svg, program);
    correctBottleTransforms(svg, program);
  }

  normalizeAplInsideWipeDepth();

  const originalRenderMap = global.renderMap;
  if (typeof originalRenderMap === "function") {
    global.renderMap = function renderMapWithPhysicalBottleSpin(...args) {
      normalizeAplInsideWipeDepth();
      const result = originalRenderMap.apply(this, args);
      postProcessMap(runtimeEls().mapSvg, currentProgramRows());
      return result;
    };
  }

  const originalRenderSimulationMap = global.renderSimulationMap;
  if (typeof originalRenderSimulationMap === "function") {
    global.renderSimulationMap = function renderSimulationMapWithPhysicalBottleSpin(...args) {
      normalizeAplInsideWipeDepth();
      const result = originalRenderSimulationMap.apply(this, args);
      const program = Array.isArray(args[0]) ? args[0] : currentSimulationRows();
      const svg = runtimeEls().simulation?.querySelector?.("#simulationSvg") || null;
      postProcessMap(svg, program);
      return result;
    };
  }

  const originalUpdateMapAnimationFrame = global.updateMapAnimationFrame;
  if (typeof originalUpdateMapAnimationFrame === "function") {
    global.updateMapAnimationFrame = function updateMapAnimationFrameWithPhysicalBottleSpin(...args) {
      normalizeAplInsideWipeDepth();
      const result = originalUpdateMapAnimationFrame.apply(this, args);
      postProcessMap(runtimeEls().mapSvg, currentProgramRows());
      return result;
    };
  }

  const originalUpdateSimulationAnimationFrame = global.updateSimulationAnimationFrame;
  if (typeof originalUpdateSimulationAnimationFrame === "function") {
    global.updateSimulationAnimationFrame = function updateSimulationAnimationFrameWithPhysicalBottleSpin(...args) {
      normalizeAplInsideWipeDepth();
      const result = originalUpdateSimulationAnimationFrame.apply(this, args);
      const svg = runtimeEls().simulation?.querySelector?.("#simulationSvg") || null;
      postProcessMap(svg, currentSimulationRows());
      return result;
    };
  }

  if (global.LabelerMechanicalMapSceneRenderer) {
    global.LabelerMechanicalMapSceneRenderer = Object.freeze({
      ...global.LabelerMechanicalMapSceneRenderer,
      renderMap: global.renderMap,
      insideWipeSignedRadiusV117: true,
      physicalBottleSpinV117: true
    });
  }
  if (global.LabelerSimulationMapSceneRenderer) {
    global.LabelerSimulationMapSceneRenderer = Object.freeze({
      ...global.LabelerSimulationMapSceneRenderer,
      renderSimulationMap: global.renderSimulationMap,
      physicalBottleSpinV117: true
    });
  }
  if (global.LabelerMapAnimationRenderer) {
    global.LabelerMapAnimationRenderer = Object.freeze({
      ...global.LabelerMapAnimationRenderer,
      updateMapAnimationFrame: global.updateMapAnimationFrame,
      updateSimulationAnimationFrame: global.updateSimulationAnimationFrame,
      physicalBottleSpinV117: true
    });
  }

  global.SERVOFORGE_BUILD_ID = BUILD_ID;
  global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 14, 2026 10:35 PM ET";
  const banner = global.document?.querySelector?.(".staging-environment-banner");
  if (banner) {
    const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
    banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 14, 2026 10:35 PM ET — NOT PRODUCTION`;
  }

  global.ServoForgeWipeInnerBottleSpinHotfix = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    physicalMachineDirection,
    physicalWipeVisualApplication,
    normalizeAplInsideWipeDepth,
    bottleVisualServoSign,
    correctBottleTransforms,
    refreshBottleProgress,
    insideWipeSignedRadiusV117: true,
    physicalBottleSpinV117: true,
    progressiveFillPhysicalDirectionV117: true
  });
})(window);
