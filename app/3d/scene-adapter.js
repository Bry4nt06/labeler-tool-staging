(function (global) {
  "use strict";

  const SCENE_VERSION = "servoforge.3d-scene.v1";

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function degToRad(value) {
    return number(value, 0) * Math.PI / 180;
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function directionSign(value, positive = 1) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "cw" || normalized === "clockwise") return -1;
    if (normalized === "ccw" || normalized === "counterclockwise" || normalized === "counter-clockwise") return 1;
    return positive;
  }

  function toSceneState(frame, options = {}) {
    if (!frame || frame.schemaVersion !== "servoforge.3d-frame.v1") {
      throw new Error("ServoForge 3D scene adapter requires a servoforge.3d-frame.v1 frame.");
    }

    const radius = Math.max(0, number(options.carouselRadius, 1));
    const tableY = number(options.tableY, 0);
    const bottleLift = number(options.bottleLift, 0.2);
    const zeroOffset = degToRad(options.zeroOffsetDegrees);
    const carouselSign = directionSign(options.carouselDirection || "cw", -1);
    const servoSign = directionSign(options.servoPositiveDirection || "ccw", 1);
    const orbitRadians = degToRad(frame.cycle.tableAngle) * carouselSign + zeroOffset;
    const servoRadians = degToRad(frame.container.servoAngleUnwrapped) * servoSign;
    const x = Math.sin(orbitRadians) * radius;
    const z = Math.cos(orbitRadians) * radius;

    return freeze({
      schemaVersion: SCENE_VERSION,
      sourceFrameVersion: frame.schemaVersion,
      active: frame.active,
      world: {
        handedness: "right-handed",
        upAxis: "y",
        orbitPlane: "xz",
        unitMode: String(options.unitMode || "normalized")
      },
      carousel: {
        radius,
        machineAngleDegrees: frame.cycle.tableAngle,
        rotationY: orbitRadians
      },
      bottleTable: {
        position: { x, y: tableY, z },
        rotation: { x: 0, y: orbitRadians, z: 0 }
      },
      bottle: {
        position: { x, y: tableY + bottleLift, z },
        rotation: { x: 0, y: servoRadians, z: 0 },
        servoAngleDegrees: frame.container.servoAngle,
        servoAngleUnwrappedDegrees: frame.container.servoAngleUnwrapped
      },
      activeServo: frame.servo ? {
        hmi: frame.servo.hmi,
        command: frame.servo.command,
        action: frame.servo.action,
        progress: frame.cycle.segmentProgress
      } : null,
      activity: frame.activity,
      flags: frame.flags
    });
  }

  global.Labeler3DSceneAdapter = Object.freeze({
    SCENE_VERSION,
    degToRad,
    toSceneState
  });
})(window);
