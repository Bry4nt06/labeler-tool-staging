"use strict";

(function installWipeInnerServoCoordinateParityV118(global) {
  const BUILD_ID = "bottle-servo-coordinate-parity-v118-20260814-2248";
  if (global.ServoForgeWipeInnerServoCoordinateParityV118?.buildId === BUILD_ID) return;

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function physicalMachineDirection() {
    const currentState = runtimeState();
    const stored = String(currentState.direction || "").toLowerCase() === "cw" ? "cw" : "ccw";
    if (typeof global.LabelerCoderOrientationDriver?.physicalDirection === "function") {
      return global.LabelerCoderOrientationDriver.physicalDirection(stored);
    }
    const service = global.LabelerWipeTelemetryService;
    if (typeof service?.physicalWipeMachineDirection === "function") {
      return service.physicalWipeMachineDirection(stored);
    }
    return stored === "cw" ? "ccw" : "cw";
  }

  function servoCoordinateVisualSign(storedDirection = runtimeState().direction) {
    if (typeof global.LabelerCoderOrientationDriver?.servoDirectionSign === "function") {
      return global.LabelerCoderOrientationDriver.servoDirectionSign(storedDirection);
    }
    return String(storedDirection || "").toLowerCase() === "cw" ? -1 : 1;
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

  // Human-readable wipe direction follows the physical CW/CCW machine direction.
  // This does NOT change the servo coordinate frame used to rotate bottle graphics.
  global.wipeVisualApplication = physicalWipeVisualApplication;
  if (global.LabelerWipeTelemetryService) {
    global.LabelerWipeTelemetryService = Object.freeze({
      ...global.LabelerWipeTelemetryService,
      wipeVisualApplication: physicalWipeVisualApplication,
      physicalDirectionSemanticsV118: true
    });
  }
  if (global.LabelerProgressiveLabelFill) {
    global.LabelerProgressiveLabelFill = Object.freeze({
      ...global.LabelerProgressiveLabelFill,
      wipeVisualApplication: physicalWipeVisualApplication,
      physicalDirectionSemanticsV118: true
    });
  }

  // Progressive-label-fill closes over its legacy raw-direction helper. Supply the
  // physical direction only while that presentation function runs, then restore
  // the persisted servo/map coordinate token immediately afterward.
  const originalBottleProgress = global.updateBottleLabelProgress;
  if (typeof originalBottleProgress === "function") {
    global.updateBottleLabelProgress = function updateBottleLabelProgressPhysicalSemantics(...args) {
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

  // Inside wipe-down pads use a signed inward radial depth. Repair any map state
  // that was temporarily made positive by v116, while leaving roller depths alone.
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

  // Normalize pad depth before full scene renders, but deliberately do not
  // post-process bottle transforms. The core Mechanical Map, Simulation, and
  // animation renderers already use:
  //   angleToSvgRotation(tableAngle) + servoDirectionSign(storedDirection) * plateAngle
  // which is the same transform used by the coder/orientation driver. v117's
  // extra physical-direction transform is therefore retired.
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
      insideWipeSignedRadiusV118: true,
      servoCoordinateBottleTransformV118: true
    });
  }
  if (global.LabelerSimulationMapSceneRenderer) {
    global.LabelerSimulationMapSceneRenderer = Object.freeze({
      ...global.LabelerSimulationMapSceneRenderer,
      renderSimulationMap: global.renderSimulationMap,
      insideWipeSignedRadiusV118: true,
      servoCoordinateBottleTransformV118: true
    });
  }

  global.SERVOFORGE_BUILD_ID = BUILD_ID;
  global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 14, 2026 10:48 PM ET";
  const banner = global.document?.querySelector?.(".staging-environment-banner");
  if (banner) {
    const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
    banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 14, 2026 10:48 PM ET — NOT PRODUCTION`;
  }

  global.ServoForgeWipeInnerServoCoordinateParityV118 = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    physicalMachineDirection,
    servoCoordinateVisualSign,
    physicalWipeVisualApplication,
    normalizeAplInsideWipeDepth,
    insideWipeSignedRadiusV118: true,
    servoCoordinateBottleTransformV118: true,
    physicalWipeSemanticsV118: true,
    v117PhysicalBottleTransformRetired: true
  });
})(window);
