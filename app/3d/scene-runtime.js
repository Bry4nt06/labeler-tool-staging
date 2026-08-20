(function (global) {
  "use strict";

  const RUNTIME_VERSION = "servoforge.3d-runtime.v3";
  const VIEWPORT_SCRIPT = "app/3d/three-scene-renderer-v09.js?v=0.9.10-3d-v09-starwheel-single-scene";
  const SPACING_OVERLAY_SCRIPT = "app/3d/measured-spacing-overlay.js?v=0.9.10-3d-v05-single-frame-telemetry";

  let lastSnapshot = null;
  let snapshotBuildCount = 0;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function frameDriver() {
    if (!global.Labeler3DSimulationFrameDriver) throw new Error("ServoForge 3D runtime requires Labeler3DSimulationFrameDriver.");
    return global.Labeler3DSimulationFrameDriver;
  }

  function sceneAdapter() {
    if (!global.Labeler3DSceneAdapter) throw new Error("ServoForge 3D runtime requires Labeler3DSceneAdapter.");
    return global.Labeler3DSceneAdapter;
  }

  function geometryAdapter() {
    if (!global.Labeler3DPhysicalGeometryAdapter) throw new Error("ServoForge 3D runtime requires Labeler3DPhysicalGeometryAdapter.");
    return global.Labeler3DPhysicalGeometryAdapter;
  }

  function carouselAdapter() {
    if (!global.Labeler3DCarouselLayoutAdapter) throw new Error("ServoForge 3D runtime requires Labeler3DCarouselLayoutAdapter.");
    return global.Labeler3DCarouselLayoutAdapter;
  }

  function labelGeometryAdapter() {
    if (!global.Labeler3DLabelGeometryAdapter) throw new Error("ServoForge 3D runtime requires Labeler3DLabelGeometryAdapter.");
    return global.Labeler3DLabelGeometryAdapter;
  }

  function labelMeshFactory() {
    if (!global.Labeler3DLabelMeshFactory) throw new Error("ServoForge 3D runtime requires Labeler3DLabelMeshFactory.");
    return global.Labeler3DLabelMeshFactory;
  }

  function wipePadGeometryAdapter() {
    if (!global.Labeler3DWipePadGeometryAdapter) throw new Error("ServoForge 3D runtime requires Labeler3DWipePadGeometryAdapter.");
    return global.Labeler3DWipePadGeometryAdapter;
  }

  function wipePadMeshFactory() {
    if (!global.Labeler3DWipePadMeshFactory) throw new Error("ServoForge 3D runtime requires Labeler3DWipePadMeshFactory.");
    return global.Labeler3DWipePadMeshFactory;
  }

  function hardwareReferenceCatalog() {
    if (!global.Labeler3DHardwareReferenceCatalog) throw new Error("ServoForge 3D runtime requires Labeler3DHardwareReferenceCatalog.");
    return global.Labeler3DHardwareReferenceCatalog;
  }

  function hardwareMeshFactory() {
    if (!global.Labeler3DHardwareMeshFactory) throw new Error("ServoForge 3D runtime requires Labeler3DHardwareMeshFactory.");
    return global.Labeler3DHardwareMeshFactory;
  }

  function equipmentAdapter() {
    if (!global.Labeler3DEquipmentLayoutAdapter) throw new Error("ServoForge 3D runtime requires Labeler3DEquipmentLayoutAdapter.");
    return global.Labeler3DEquipmentLayoutAdapter;
  }

  function appState() {
    try {
      if (typeof state !== "undefined" && state && typeof state === "object") return state;
    } catch {
      // The lexical application state may not be available in isolated tests.
    }
    return global.state && typeof global.state === "object" ? global.state : null;
  }

  function generatedProgram() {
    const current = appState();
    return Array.isArray(current?.program) ? current.program : [];
  }

  function activeMachineMap(current) {
    try {
      const fromService = global.LabelerMapRuntimeService?.activeMachineMap?.();
      if (fromService) return fromService;
    } catch {
      // Fall through to state mirror.
    }
    const maps = Array.isArray(current?.mapLibrary) ? current.mapLibrary : [];
    return maps.find((map) => map?.id === current?.activeMapId) || maps[0] || null;
  }

  function snapshot(options = {}) {
    const current = appState() || {};
    const rows = Array.isArray(options.rows) ? options.rows : generatedProgram();
    const tableAngle = number(options.tableAngle, number(current?.previewAngle, 0));
    const frame = frameDriver().snapshot(rows, tableAngle, {
      commandDriver: options.commandDriver || global.LabelerServoCommandDriver,
      plan: options.plan || null,
      preferredHmi: options.preferredHmi
    });
    const geometry = geometryAdapter().snapshot(current, {
      worldUnitsPerMm: options.scene?.worldUnitsPerMm
    });
    labelGeometryAdapter();
    labelMeshFactory();
    wipePadGeometryAdapter();
    wipePadMeshFactory();
    hardwareReferenceCatalog();
    hardwareMeshFactory();

    const requestedScene = options.scene || {};
    const carouselDirection = current?.direction || "ccw";
    const zeroAngleDegrees = number(current?.zeroAngle, 0);
    const sceneOptions = {
      carouselDirection,
      zeroAngleDegrees,
      ...requestedScene,
      carouselRadius: Number.isFinite(Number(requestedScene.carouselRadius))
        ? Number(requestedScene.carouselRadius)
        : geometry.machine.pitchRadiusWorld
    };
    const scene = sceneAdapter().toSceneState(frame, sceneOptions);
    const carousel = carouselAdapter().snapshot(scene, geometry, {
      carouselDirection,
      zeroAngleDegrees,
      tableY: number(requestedScene.tableY, 0)
    });
    const machineMap = options.machineMap || activeMachineMap(current);
    const labels = labelGeometryAdapter().snapshot(current, geometry, machineMap, tableAngle);
    const equipment = equipmentAdapter().snapshot(machineMap, current, geometry, {
      carouselDirection,
      zeroAngleDegrees
    });

    snapshotBuildCount += 1;
    lastSnapshot = Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      readOnly: true,
      frame,
      geometry,
      carousel,
      labels,
      equipment,
      scene
    });
    return lastSnapshot;
  }

  function latestSnapshot() {
    return lastSnapshot;
  }

  function status() {
    const hardwareStatus = global.Labeler3DHardwareReferenceCatalog?.status?.() || null;
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      ready: Boolean(
        global.Labeler3DSimulationFrameDriver
        && global.Labeler3DSceneAdapter
        && global.Labeler3DPhysicalGeometryAdapter
        && global.Labeler3DCarouselLayoutAdapter
        && global.Labeler3DLabelGeometryAdapter
        && global.Labeler3DLabelMeshFactory
        && global.Labeler3DWipePadGeometryAdapter
        && global.Labeler3DWipePadMeshFactory
        && global.Labeler3DHardwareReferenceCatalog
        && global.Labeler3DHardwareMeshFactory
        && global.Labeler3DEquipmentLayoutAdapter
        && global.LabelerServoReplayDriver
      ),
      readOnly: true,
      source: "generated-servo-program",
      snapshotAuthority: "canonical-3d-render-frame",
      snapshotBuildCount,
      hasLatestSnapshot: Boolean(lastSnapshot),
      viewportAuthority: "starwheel-bottle-handling-single-scene-v09",
      legacyCarouselViewportRetired: true,
      geometry: "measured-plate-spacing-plus-active-bottle-profile",
      carousel: "machine-head-count-and-user-measured-plate-spacing",
      labels: "active-label-spec-wraps-with-reference-artwork",
      labelWrapAuthority: "active-servoforge-label-spec",
      labelArtworkAuthority: false,
      labelBodyBackVerticalAuthority: false,
      labelNeckHeightSource: "active-label-spec-neckHeightMm",
      equipment: "active-machine-map-angles-plus-hardware-reference-catalog",
      equipmentCadAuthority: false,
      hardwareReferenceCatalog: hardwareStatus?.catalogVersion || null,
      hardwareReferenceSource: hardwareStatus?.referenceSource || null,
      hardwareReferenceProfiles: hardwareStatus?.profileCount || 0,
      wipePadGeometryAuthority: "user-measured",
      wipePadRenderAuthority: "measured-annular-sponge-and-steel",
      wipePadHeightMm: 70,
      wipePadSpongeThicknessMm: 18,
      wipePadBackingPlateThicknessMm: 4,
      wipePadTotalThicknessMm: 22,
      wipePadBottlePenetrationMm: 2,
      wipePadVerticalMountAuthority: false,
      spenderPlateMechanicalHierarchyAuthority: true,
      spenderPlateDimensionalAuthority: false,
      spenderPlateReferenceAuthority: "user-supplied-machine-photos",
      spenderPlateAdjustmentAuthority: false,
      spenderPlateAdjustmentPivots: Object.freeze(["forward-angle", "side-angle", "engagement-angle"]),
      rollersRenderedIn3D: true,
      rollerDimensionalAuthority: false,
      coderRenderedIn3D: true,
      coderDimensionalAuthority: false,
      coderTimingLogicUntouched: true,
      sensorsRenderedIn3D: true,
      sensorDimensionalAuthority: false,
      sensorRuntimeDataPreserved: true,
      sensorFovAuthority: "servoforge-runtime-data",
      passiveServoMode: "neutral-no-invented-motion",
      plannerPitchGeometryUntouched: true,
      viewport: Boolean(global.Labeler3DViewport),
      measuredSpacingTelemetry: Boolean(global.Labeler3DMeasuredSpacingOverlay)
    });
  }

  function loadMeasuredSpacingOverlay() {
    const documentRef = global.document;
    if (!documentRef?.createElement) return false;
    if (documentRef.querySelector("script[data-servoforge-3d-spacing-overlay]")) return false;
    const script = documentRef.createElement("script");
    script.src = `./${SPACING_OVERLAY_SCRIPT}`;
    script.async = true;
    script.dataset.servoforge3dSpacingOverlay = "v2";
    script.addEventListener("error", () => console.warn("ServoForge measured bottle-plate spacing telemetry could not be loaded."), { once: true });
    (documentRef.body || documentRef.head || documentRef.documentElement).appendChild(script);
    return true;
  }

  function loadViewportRenderer() {
    const documentRef = global.document;
    if (!documentRef?.createElement) return false;
    const existing = documentRef.querySelector("script[data-servoforge-3d-viewport]");
    if (existing) {
      loadMeasuredSpacingOverlay();
      return false;
    }
    const script = documentRef.createElement("script");
    script.src = `./${VIEWPORT_SCRIPT}`;
    script.async = true;
    script.dataset.servoforge3dViewport = "v0.9";
    script.addEventListener("load", loadMeasuredSpacingOverlay, { once: true });
    script.addEventListener("error", () => console.warn("ServoForge starwheel bottle-handling viewport could not be loaded. Core 3D frame runtime remains available."), { once: true });
    (documentRef.body || documentRef.head || documentRef.documentElement).appendChild(script);
    return true;
  }

  global.Labeler3DSceneRuntime = Object.freeze({
    RUNTIME_VERSION,
    snapshot,
    latestSnapshot,
    status,
    loadViewport: loadViewportRenderer,
    loadMeasuredSpacingTelemetry: loadMeasuredSpacingOverlay
  });

  loadViewportRenderer();
})(window);
