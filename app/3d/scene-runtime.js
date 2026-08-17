(function (global) {
  "use strict";

  const RUNTIME_VERSION = "servoforge.3d-runtime.v1";
  const VIEWPORT_SCRIPT = "app/3d/three-scene-renderer.js?v=0.9.10-3d-v021-longneck-reference";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function frameDriver() {
    if (!global.Labeler3DSimulationFrameDriver) {
      throw new Error("ServoForge 3D runtime requires Labeler3DSimulationFrameDriver.");
    }
    return global.Labeler3DSimulationFrameDriver;
  }

  function sceneAdapter() {
    if (!global.Labeler3DSceneAdapter) {
      throw new Error("ServoForge 3D runtime requires Labeler3DSceneAdapter.");
    }
    return global.Labeler3DSceneAdapter;
  }

  function geometryAdapter() {
    if (!global.Labeler3DPhysicalGeometryAdapter) {
      throw new Error("ServoForge 3D runtime requires Labeler3DPhysicalGeometryAdapter.");
    }
    return global.Labeler3DPhysicalGeometryAdapter;
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
    const requestedScene = options.scene || {};
    const sceneOptions = {
      carouselDirection: current?.direction || "ccw",
      zeroAngleDegrees: number(current?.zeroAngle, 0),
      ...requestedScene,
      carouselRadius: Number.isFinite(Number(requestedScene.carouselRadius))
        ? Number(requestedScene.carouselRadius)
        : geometry.machine.pitchRadiusWorld
    };
    const scene = sceneAdapter().toSceneState(frame, sceneOptions);
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      readOnly: true,
      frame,
      geometry,
      scene
    });
  }

  function status() {
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      ready: Boolean(
        global.Labeler3DSimulationFrameDriver
        && global.Labeler3DSceneAdapter
        && global.Labeler3DPhysicalGeometryAdapter
        && global.LabelerServoReplayDriver
      ),
      readOnly: true,
      source: "generated-servo-program",
      geometry: "active-bottle-diameter-plus-longneck-reference-profile",
      viewport: Boolean(global.Labeler3DViewport)
    });
  }

  function loadViewportRenderer() {
    const documentRef = global.document;
    if (!documentRef?.createElement) return false;
    if (documentRef.querySelector("script[data-servoforge-3d-viewport]")) return false;
    const script = documentRef.createElement("script");
    script.src = `./${VIEWPORT_SCRIPT}`;
    script.async = true;
    script.dataset.servoforge3dViewport = "v0.2.1";
    script.addEventListener("error", () => {
      console.warn("ServoForge 3D viewport presenter could not be loaded. Core 3D frame runtime remains available.");
    }, { once: true });
    (documentRef.body || documentRef.head || documentRef.documentElement).appendChild(script);
    return true;
  }

  global.Labeler3DSceneRuntime = Object.freeze({
    RUNTIME_VERSION,
    snapshot,
    status,
    loadViewport: loadViewportRenderer
  });

  loadViewportRenderer();
})(window);
