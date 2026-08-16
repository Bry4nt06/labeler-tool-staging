"use strict";

(function installPhysicalWipeDirectionV125(global) {
  const BUILD_ID = "physical-wipe-direction-v125-20260816-0905";
  if (global.ServoForgePhysicalWipeDirectionV125?.buildId === BUILD_ID) return;

  function runtimeState() {
    try { return state; }
    catch { return global.state || {}; }
  }

  function normalizedDirection(value, fallback = "ccw") {
    const normalized = String(value || "").toLowerCase();
    return normalized === "cw" || normalized === "ccw" ? normalized : fallback;
  }

  function storedMachineDirection() {
    try {
      const selected = String(global.document?.getElementById?.("mapDirection")?.value || "").toLowerCase();
      if (selected === "cw" || selected === "ccw") return selected;
    } catch { }
    try {
      const configured = String(global.activeMachineMap?.()?.machineSettings?.direction || "").toLowerCase();
      if (configured === "cw" || configured === "ccw") return configured;
    } catch { }
    return normalizedDirection(runtimeState().direction);
  }

  function physicalDirectionForStored(storedDirection = storedMachineDirection()) {
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
    return physicalDirectionForStored(storedMachineDirection());
  }

  function physicalWipeVisualSideForPlateTravel(plateTravel, storedDirection = storedMachineDirection()) {
    const travel = Number(plateTravel);
    if (!Number.isFinite(travel) || Math.abs(travel) <= 0.000001) return null;
    const machineDirection = physicalDirectionForStored(storedDirection);
    const renderedBottleRotation = (machineDirection === "cw" ? -1 : 1) * travel;
    return renderedBottleRotation > 0 ? "left" : "right";
  }

  function restorePhysicalCenterCoverage(coverage, tackMode) {
    if (!coverage || String(tackMode || "").toLowerCase() !== "center") return coverage;
    return {
      ...coverage,
      leftPercent: Number(coverage.rightPercent) || 0,
      rightPercent: Number(coverage.leftPercent) || 0
    };
  }

  const previousTelemetry = global.LabelerWipeTelemetryService;
  if (previousTelemetry) {
    const previousCoverage = previousTelemetry.contactedLabelCoverage;
    const previousTelemetryFn = previousTelemetry.wipeDownTelemetry;
    const v119CenterSwapActive = Boolean(previousTelemetry.centerTackServoSideParityV119);

    const contactedLabelCoveragePhysical = typeof previousCoverage === "function"
      ? function contactedLabelCoveragePhysical(...args) {
        const coverage = previousCoverage.apply(this, args);
        const visual = args[4];
        return v119CenterSwapActive
          ? restorePhysicalCenterCoverage(coverage, visual?.tackMode)
          : coverage;
      }
      : previousCoverage;

    const wipeDownTelemetryPhysical = typeof previousTelemetryFn === "function"
      ? function wipeDownTelemetryPhysical(...args) {
        const telemetry = previousTelemetryFn.apply(this, args);
        return v119CenterSwapActive
          ? restorePhysicalCenterCoverage(telemetry, telemetry?.tackMode)
          : telemetry;
      }
      : previousTelemetryFn;

    global.LabelerWipeTelemetryService = Object.freeze({
      ...previousTelemetry,
      wipeVisualSideForPlateTravel: physicalWipeVisualSideForPlateTravel,
      contactedLabelCoverage: contactedLabelCoveragePhysical,
      wipeDownTelemetry: wipeDownTelemetryPhysical,
      centerTackServoSideParityV119: false,
      physicalCenterWipeDirectionV125: true,
      physicalDirectionSemanticsV125: true
    });
  }

  if (global.LabelerProgressiveLabelFill) {
    global.LabelerProgressiveLabelFill = Object.freeze({
      ...global.LabelerProgressiveLabelFill,
      centerTackServoSideParityV119: false,
      physicalCenterWipeDirectionV125: true,
      physicalDirectionSemanticsV125: true
    });
  }

  global.SERVOFORGE_BUILD_ID = BUILD_ID;
  global.SERVOFORGE_BUILD_UPDATED_AT = "Aug 16, 2026 9:05 AM ET";

  const banner = global.document?.querySelector?.(".staging-environment-banner");
  if (banner) {
    const version = String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10");
    banner.textContent = `STAGING ${version} • BUILD ${BUILD_ID} • UPDATED Aug 16, 2026 9:05 AM ET — NOT PRODUCTION`;
  }

  global.ServoForgePhysicalWipeDirectionV125 = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    storedMachineDirection,
    physicalDirectionForStored,
    physicalMachineDirection,
    physicalWipeVisualSideForPlateTravel,
    restorePhysicalCenterCoverage,
    physicalCenterWipeDirectionV125: true,
    bottleTransformUnchangedV125: true
  });
})(window);
