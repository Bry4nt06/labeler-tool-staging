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

  function machineOrbit(tableAngle, options = {}) {
    const direction = String(options.carouselDirection || "ccw").trim().toLowerCase();
    const clockwise = direction === "cw" || direction === "clockwise";
    const signed = clockwise ? -1 : 1;
    const zeroBase = clockwise ? 180 : 0;
    const zeroAngle = number(options.zeroAngleDegrees, 0);
    const bearingDegrees = zeroBase + zeroAngle + signed * number(tableAngle, 0);
    const radians = degToRad(bearingDegrees);
    const radius = Math.max(0, number(options.carouselRadius, 1));
    return Object.freeze({
      bearingDegrees,
      radians,
      x: Math.cos(radians) * radius,
      z: Math.sin(radians) * radius
    });
  }

  function toSceneState(frame, options = {}) {
    if (!frame || frame.schemaVersion !== "servoforge.3d-frame.v1") {
      throw new Error("ServoForge 3D scene adapter requires a servoforge.3d-frame.v1 frame.");
    }

    const radius = Math.max(0, number(options.carouselRadius, 1));
    const tableY = number(options.tableY, 0);
    const bottleLift = number(options.bottleLift, 0.2);
    const carouselDirection = String(options.carouselDirection || "ccw");
    const orbit = machineOrbit(frame.cycle.tableAngle, { ...options, carouselRadius: radius });
    const servoSign = directionSign(options.servoPositiveDirection || carouselDirection, 1);
    const servoRadians = degToRad(frame.container.servoAngleUnwrapped) * servoSign;
    const bottleAbsoluteRotationY = orbit.radians + servoRadians;

    return freeze({
      schemaVersion: SCENE_VERSION,
      sourceFrameVersion: frame.schemaVersion,
      active: frame.active,
      world: {
        handedness: "right-handed",
        upAxis: "y",
        orbitPlane: "xz",
        unitMode: String(options.unitMode || "normalized"),
        mapCoordinateParity: true
      },
      carousel: {
        radius,
        machineAngleDegrees: frame.cycle.tableAngle,
        mapBearingDegrees: orbit.bearingDegrees,
        rotationY: orbit.radians
      },
      bottleTable: {
        position: { x: orbit.x, y: tableY, z: orbit.z },
        rotation: { x: 0, y: orbit.radians, z: 0 },
        servoPlateRotationY: bottleAbsoluteRotationY,
        servoRotationY: servoRadians
      },
      bottle: {
        position: { x: orbit.x, y: tableY + bottleLift, z: orbit.z },
        rotation: { x: 0, y: bottleAbsoluteRotationY, z: 0 },
        mapRotationY: orbit.radians,
        servoRotationY: servoRadians,
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
    machineOrbit,
    toSceneState
  });
})(window);
