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

  // ServoForge's Mechanical Map/SVG convention places a mathematical bearing
  // at x = cos(angle), y/z = sin(angle). Three.js uses a right-handed Y-up
  // world where a positive rotation about +Y turns local +X toward -Z. To make
  // a Three.js object visually point at the same bearing as the authoritative
  // ServoForge top view, every map-plane angle must therefore be negated when
  // converted into Object3D.rotation.y.
  function mapRadiansToThreeRotationY(mapRadians) {
    return -number(mapRadians, 0);
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
      threeRotationY: mapRadiansToThreeRotationY(radians),
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

    // Match the exact ServoForge 2D formula:
    //   referenceRotation = mapBearing + servoSign * padAngle
    // The signed servo angle remains a ServoForge/map-plane value first. Only
    // after that do we convert it into Three.js' opposite Y-rotation convention.
    const servoSign = directionSign(options.servoPositiveDirection || carouselDirection, 1);
    const servoMapRadians = degToRad(frame.container.servoAngleUnwrapped) * servoSign;
    const servoThreeRotationY = mapRadiansToThreeRotationY(servoMapRadians);
    const bottleAbsoluteMapRadians = orbit.radians + servoMapRadians;
    const bottleAbsoluteRotationY = mapRadiansToThreeRotationY(bottleAbsoluteMapRadians);

    return freeze({
      schemaVersion: SCENE_VERSION,
      sourceFrameVersion: frame.schemaVersion,
      active: frame.active,
      world: {
        handedness: "right-handed",
        upAxis: "y",
        orbitPlane: "xz",
        unitMode: String(options.unitMode || "normalized"),
        mapCoordinateParity: true,
        mapToThreeRotationY: "negate-map-plane-radians"
      },
      carousel: {
        radius,
        machineAngleDegrees: frame.cycle.tableAngle,
        mapBearingDegrees: orbit.bearingDegrees,
        mapRotationRadians: orbit.radians,
        rotationY: orbit.threeRotationY
      },
      bottleTable: {
        position: { x: orbit.x, y: tableY, z: orbit.z },
        rotation: { x: 0, y: orbit.threeRotationY, z: 0 },
        servoPlateRotationY: bottleAbsoluteRotationY,
        servoRotationY: servoThreeRotationY,
        servoMapRotationRadians: servoMapRadians
      },
      bottle: {
        position: { x: orbit.x, y: tableY + bottleLift, z: orbit.z },
        rotation: { x: 0, y: bottleAbsoluteRotationY, z: 0 },
        mapRotationY: orbit.threeRotationY,
        mapBearingRadians: orbit.radians,
        servoRotationY: servoThreeRotationY,
        servoMapRotationRadians: servoMapRadians,
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
    mapRadiansToThreeRotationY,
    machineOrbit,
    toSceneState
  });
})(window);
