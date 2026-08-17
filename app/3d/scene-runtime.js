(function (global) {
  "use strict";

  const RUNTIME_VERSION = "servoforge.3d-runtime.v1";

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

  function generatedProgram() {
    return Array.isArray(global.state?.program) ? global.state.program : [];
  }

  function snapshot(options = {}) {
    const rows = Array.isArray(options.rows) ? options.rows : generatedProgram();
    const tableAngle = number(options.tableAngle, number(global.state?.previewAngle, 0));
    const frame = frameDriver().snapshot(rows, tableAngle, {
      commandDriver: options.commandDriver || global.LabelerServoCommandDriver,
      plan: options.plan || null,
      preferredHmi: options.preferredHmi
    });
    const scene = sceneAdapter().toSceneState(frame, options.scene || {});
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      readOnly: true,
      frame,
      scene
    });
  }

  function status() {
    return Object.freeze({
      runtimeVersion: RUNTIME_VERSION,
      ready: Boolean(global.Labeler3DSimulationFrameDriver && global.Labeler3DSceneAdapter && global.LabelerServoReplayDriver),
      readOnly: true,
      source: "generated-servo-program"
    });
  }

  global.Labeler3DSceneRuntime = Object.freeze({
    RUNTIME_VERSION,
    snapshot,
    status
  });
})(window);
