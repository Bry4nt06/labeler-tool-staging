"use strict";

(function installWipeSideServoParityV119(global) {
  const BUILD_ID = "wipe-side-servo-parity-v119-20260814-2302";
  if (global.ServoForgeWipeSideServoParityV119?.buildId === BUILD_ID) return;

  let storedDirectionDuringProgress = null;

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function normalizedDirection(value, fallback = "ccw") {
    const normalized = String(value || "").toLowerCase();
    return normalized === "cw" || normalized === "ccw" ? normalized : fallback;
  }

  function storedServoDirection() {
    if (storedDirectionDuringProgress) return storedDirectionDuringProgress;
    try {
      const selected = String(global.document?.getElementById?.("mapDirection")?.value || "").toLowerCase();
      if (selected === "cw" || selected === "ccw") return selected;
    } catch {
      // Fall through to the active map/runtime state.
    }
    try {
      const configured = String(global.activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();
      if (configured === "cw" || configured === "ccw") return configured;
    } catch {
      // Fall through to runtime state.
    }
    return normalizedDirection(runtimeState().direction);
  }

  function physicalDirectionForStored(storedDirection = storedServoDirection()) {
    const stored = normalizedDirection(storedDirection);
    if (typeof global.LabelerCoderOrientationDriver?.physicalDirection === "function") {
      return global.LabelerCoderOrientationDriver.physicalDirection(stored);
    }
    const service = global.LabelerWipeTelemetryService;
    if (typeof service?.physicalWipeMachineDirection === "function") {
      return service.physicalWipeMachineDirection(stored);
    }
    return stored === "cw" ? "ccw" : "cw";
  }

  function physicalMachineDirection() {
    return physicalDirectionForStored(storedServoDirection());
  }

  function servoCoordinateVisualSign(storedDirection = storedServoDirection()) {
    const stored = normalizedDirection(storedDirection);
    if (typeof global.LabelerCoderOrientationDriver?.servoDirectionSign === "function") {
      return Number(global.LabelerCoderOrientationDriver.servoDirectionSign(stored)) || (stored === "cw" ? -1 : 1);
    }
    return stored === "cw" ? -1 : 1;
  }

  function physicalVisualSign(storedDirection = storedServoDirection()) {
    return physicalDirectionForStored(storedDirection) === "cw" ? -1 : 1;
  }

  function servoWipeVisualSideForPlateTravel(plateTravel, storedDirection = storedServoDirection()) {
    const travel = Number(plateTravel);
    if (!Number.isFinite(travel) || Math.abs(travel) <= 0.000001) return null;
    const renderedBottleRotation = servoCoordinateVisualSign(storedDirection) * travel;
    return renderedBottleRotation > 0 ? "left" : "right";
  }

  function centerTackNeedsSideSwap(storedDirection = storedServoDirection()) {
    return servoCoordinateVisualSign(storedDirection) !== physicalVisualSign(storedDirection);
  }

  function swapCenterCoverage(coverage, tackMode, storedDirection = storedServoDirection()) {
    if (!coverage || String(tackMode || "").toLowerCase() !== "center") return coverage;
    if (!centerTackNeedsSideSwap(storedDirection)) return coverage;
    return {
      ...coverage,
      leftPercent: Number(coverage.rightPercent) || 0,
      rightPercent: Number(coverage.leftPercent) || 0
    };
  }

  function applicationReference(section) {
    const normalizedSection = String(section || "").trim().toLowerCase();
    const progressive = global.LabelerProgressiveLabelFill;
    if (typeof progressive?.wipeApplicationReference === "function") {
      return progressive.wipeApplicationReference(normalizedSection);
    }
    const buildInputs = runtimeState().buildInputs || {};
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
    const buildInputs = runtimeState().buildInputs || {};
    const reference = applicationReference(normalizedSection);
    const tackMode = reference === "center-tack" ? "center" : "leading";
    const direction = physicalMachineDirection() === "cw" ? "ltr" : "rtl";
    const number = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const backspinMm = normalizedSection === "neck"
      ? number(buildInputs.neckContactMm, 0)
      : normalizedSection === "body"
        ? number(buildInputs.bodyContactMm, 5)
        : normalizedSection === "back"
          ? number(buildInputs.backContactMm, 5)
          : 0;
    const length = Math.max(0, number(labelLengthMm, 0));
    const backspinPercent = length > 0
      ? Math.max(0, Math.min(100, 100 * backspinMm / length))
      : 0;
    return { tackMode, direction, backspinMm, backspinPercent, applicationReference: reference };
  }

  global.wipeVisualApplication = physicalWipeVisualApplication;

  const baseTelemetry = global.LabelerWipeTelemetryService;
  if (baseTelemetry) {
    const originalCoverage = baseTelemetry.contactedLabelCoverage;
    const originalTelemetry = baseTelemetry.wipeDownTelemetry;

    const contactedLabelCoverageServoParity = typeof originalCoverage === "function"
      ? function contactedLabelCoverageServoParity(program, section, station, throughTableAngle, visual) {
        const storedDirection = storedServoDirection();
        const coverage = originalCoverage(program, section, station, throughTableAngle, visual);
        return swapCenterCoverage(coverage, visual?.tackMode, storedDirection);
      }
      : originalCoverage;

    const wipeDownTelemetryServoParity = typeof originalTelemetry === "function"
      ? function wipeDownTelemetryServoParity(...args) {
        const storedDirection = storedServoDirection();
        const telemetry = originalTelemetry.apply(this, args);
        return swapCenterCoverage(telemetry, telemetry?.tackMode, storedDirection);
      }
      : originalTelemetry;

    global.LabelerWipeTelemetryService = Object.freeze({
      ...baseTelemetry,
      wipeVisualApplication: physicalWipeVisualApplication,
      wipeVisualSideForPlateTravel: servoWipeVisualSideForPlateTravel,
      contactedLabelCoverage: contactedLabelCoverageServoParity,
      wipeDownTelemetry: wipeDownTelemetryServoParity,
      centerTackServoSideParityV119: true,
      physicalDirectionSemanticsV119: true
    });
  }

  if (global.LabelerProgressiveLabelFill) {
    global.LabelerProgressiveLabelFill = Object.freeze({
      ...global.LabelerProgressiveLabelFill,
      wipeVisualApplication: physicalWipeVisualApplication,
      centerTackServoSideParityV119: true,
      physicalDirectionSemanticsV119: true
    });
  }

  // The progressive-fill integration closes over its legacy raw-direction helper.
  // Give that helper physical CW/CCW for leading-edge semantics, while retaining the
  // original stored servo direction separately so center-tack left/right coverage is
  // corrected in the servo-coordinate frame used by the bottle graphic.
  const originalBottleProgress = global.updateBottleLabelProgress;
  if (typeof originalBottleProgress === "function") {
    global.updateBottleLabelProgress = function updateBottleLabelProgressPhysicalSemantics(...args) {
      const currentState = runtimeState();
      const storedDirection = normalizedDirection(currentState.direction);
      storedDirectionDuringProgress = storedDirection;
      currentState.direction = physicalDirectionForStored(storedDirection);
      try {
        return originalBottleProgress.apply(this, args);
      } finally {
        currentState.direction = storedDirection;
        storedDirectionDuringProgress = null;
      }
    };
  }

  // Inside wipe-down pads remain signed inward. v119 does not alter bottle transforms.
  function normalizeAplInsideWipeDepth() {
    const currentState = runtimeState();
    if (String(currentState.applicationMode || "").toLowerCase() === "cold-glue") return false;
    if (!currentState.depths) return false;
    const rawDepth = Number(currentState.depths.wipeInner);
    if (!Number.isFinite(rawDepth)) return false;
    const insideDepth = rawDepth === 0 ? 0 : -Math.abs(rawDepth);
    if (rawDepth === insideDepth) return false;
    currentState.depths.wipeInner = insideDepth;
    return true;
  }

  normalizeAplInsideWipeDepth();

  const originalRenderMap = global.renderMap;
  if (typeof originalRenderMap === "function") {
    global.renderMap = function renderMapWithInsideWipeDepth(...args) {
      normalizeAplInsideWipeDepth();
      return originalRenderMap.apply(this, args);
    };
  }

  const originalRenderSimulationMap = global.renderSimulationMap;
  if (typeof originalRenderSimulationMap === "function") {
    global.renderSimulationMap = function renderSimulationMapWithInsideWipeDepth(...args) {
      normalizeAplInsideWipeDepth();
      return originalRenderSimulationMap.apply(this, args);
    };
  }

  if (global.LabelerMechanicalMapSceneRenderer) {
    global.LabelerMechanicalMapSceneRenderer = Object.freeze({
      ...global.LabelerMechanicalMapSceneRenderer,
      renderMap: global.renderMap,
      insideWipeSignedRadiusV119: true,
      servoCoordinateBottleTransformV119: true
    });
  }
  if (global.LabelerSimulationMapSceneRenderer) {
    global.LabelerSimulationMapSceneRenderer = Object.freeze({
      ...global.LabelerSimulationMapSceneRenderer,
      renderSimulationMap: global.renderSimulationMap,
      insideWipeSignedRadiusV119: true,
      servoCoordinateBottleTransformV119: true
    });
  }

  global.SERVOFORGE_BUILD_ID = BUILD_ID;
  global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 14, 2026 11:02 PM ET";
  const banner = global.document?.querySelector?.(".staging-environment-banner");
  if (banner) {
    const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
    banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 14, 2026 11:02 PM ET — NOT PRODUCTION`;
  }

  global.ServoForgeWipeSideServoParityV119 = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    storedServoDirection,
    physicalMachineDirection,
    servoCoordinateVisualSign,
    servoWipeVisualSideForPlateTravel,
    centerTackNeedsSideSwap,
    swapCenterCoverage,
    physicalWipeVisualApplication,
    normalizeAplInsideWipeDepth,
    centerTackServoSideParityV119: true,
    insideWipeSignedRadiusV119: true,
    servoCoordinateBottleTransformV119: true,
    physicalWipeSemanticsV119: true
  });
})(window);
