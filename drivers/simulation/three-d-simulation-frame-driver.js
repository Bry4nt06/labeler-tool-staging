(function (global) {
  "use strict";

  const SCHEMA_VERSION = "servoforge.3d-frame.v1";
  const PRODUCTION_ROTATION_COMMAND = 7;

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeAngle(value) {
    const normalized = number(value, 0) % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  function copyList(value) {
    return Array.isArray(value) ? value.map((item) => String(item)) : [];
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function replayDriver() {
    const driver = global.LabelerServoReplayDriver;
    if (!driver || typeof driver.buildFrames !== "function" || typeof driver.indexAtAngle !== "function" || typeof driver.frameProgress !== "function") {
      throw new Error("ServoForge 3D requires LabelerServoReplayDriver before the 3D frame driver is used.");
    }
    return driver;
  }

  function isProductionRotationCommand(command) {
    return number(command, 3) === PRODUCTION_ROTATION_COMMAND;
  }

  function prepare(rows, options = {}) {
    const replay = replayDriver();
    const sourceFrames = replay.buildFrames(Array.isArray(rows) ? rows : [], options);
    let cumulativeNet = 0;
    let cumulativeAbsolute = 0;

    const frames = sourceFrames.map((frame, index) => {
      const plateStart = number(frame?.plateStart, 0);
      const plateEnd = number(frame?.plateEnd, plateStart);
      const executesRotation = isProductionRotationCommand(frame?.command);
      const executedPlateTravel = executesRotation ? plateEnd - plateStart : 0;
      const normalized = {
        index,
        hmi: frame?.hmi ?? index + 1,
        plc: frame?.plc ?? index,
        command: number(frame?.command, 3),
        commandName: String(frame?.commandName || ""),
        action: String(frame?.action || "Servo move"),
        eventId: String(frame?.eventId || `EV${String(index + 1).padStart(3, "0")}`),
        processId: String(frame?.processId || frame?.eventId || ""),
        eventType: String(frame?.eventType || "GENERAL"),
        aggregate: Number.isFinite(Number(frame?.aggregate)) ? Number(frame.aggregate) : null,
        section: String(frame?.section || ""),
        stage: String(frame?.stage || ""),
        referenceRole: String(frame?.referenceRole || ""),
        plannerIntent: String(frame?.plannerIntent || (executesRotation ? "ROTATE" : "HOLD")),
        objectIds: copyList(frame?.objectIds),
        objectNames: copyList(frame?.objectNames),
        tableStart: number(frame?.tableStart, 0),
        tableEnd: number(frame?.tableEnd, number(frame?.tableStart, 0)),
        plateStart,
        plateEnd,
        executesRotation,
        executedPlateTravel,
        cumulativeNetBefore: cumulativeNet,
        cumulativeAbsoluteBefore: cumulativeAbsolute,
        terminal: Boolean(frame?.terminal),
        pauseReference: Boolean(frame?.pauseReference)
      };
      cumulativeNet += executedPlateTravel;
      cumulativeAbsolute += Math.abs(executedPlateTravel);
      normalized.cumulativeNetAfter = cumulativeNet;
      normalized.cumulativeAbsoluteAfter = cumulativeAbsolute;
      return freeze(normalized);
    });

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      frameCount: frames.length,
      frames
    });
  }

  function emptySnapshot(tableAngle = 0) {
    return freeze({
      schemaVersion: SCHEMA_VERSION,
      active: false,
      cycle: {
        tableAngle: normalizeAngle(tableAngle),
        tableAngleUnwrapped: number(tableAngle, 0),
        segmentProgress: 0
      },
      servo: null,
      container: {
        servoAngle: 0,
        servoAngleUnwrapped: 0,
        segmentStartAngle: 0,
        segmentTargetAngle: 0,
        segmentDeltaAngle: 0,
        cumulativeNetRotation: 0,
        cumulativeAbsoluteRotation: 0
      },
      activity: {
        eventId: "",
        processId: "",
        eventType: "GENERAL",
        aggregate: null,
        section: "",
        stage: "",
        objectIds: [],
        objectNames: []
      },
      flags: {
        executesRotation: false,
        hold: true,
        terminal: false,
        pauseReference: false
      }
    });
  }

  function snapshotPrepared(prepared, tableAngle, preferredHmi = null) {
    const replay = replayDriver();
    const frames = Array.isArray(prepared?.frames) ? prepared.frames : [];
    if (!frames.length) return emptySnapshot(tableAngle);

    const index = replay.indexAtAngle(frames, tableAngle, preferredHmi);
    const frame = index >= 0 ? frames[index] : null;
    if (!frame) return emptySnapshot(tableAngle);

    const progress = replay.frameProgress(frame, tableAngle);
    const executedTravel = number(frame.executedPlateTravel, 0);
    const servoAngleUnwrapped = number(frame.plateStart, 0) + executedTravel * progress;
    const cumulativeNetRotation = number(frame.cumulativeNetBefore, 0) + executedTravel * progress;
    const cumulativeAbsoluteRotation = number(frame.cumulativeAbsoluteBefore, 0) + Math.abs(executedTravel) * progress;

    return freeze({
      schemaVersion: SCHEMA_VERSION,
      active: true,
      cycle: {
        tableAngle: normalizeAngle(tableAngle),
        tableAngleUnwrapped: number(tableAngle, 0),
        segmentProgress: progress
      },
      servo: {
        frameIndex: frame.index,
        hmi: frame.hmi,
        plc: frame.plc,
        command: frame.command,
        commandName: frame.commandName,
        action: frame.action,
        plannerIntent: frame.plannerIntent,
        referenceRole: frame.referenceRole
      },
      container: {
        servoAngle: normalizeAngle(servoAngleUnwrapped),
        servoAngleUnwrapped,
        segmentStartAngle: frame.plateStart,
        segmentTargetAngle: frame.executesRotation ? frame.plateEnd : frame.plateStart,
        segmentDeltaAngle: executedTravel,
        cumulativeNetRotation,
        cumulativeAbsoluteRotation
      },
      activity: {
        eventId: frame.eventId,
        processId: frame.processId,
        eventType: frame.eventType,
        aggregate: frame.aggregate,
        section: frame.section,
        stage: frame.stage,
        objectIds: copyList(frame.objectIds),
        objectNames: copyList(frame.objectNames)
      },
      flags: {
        executesRotation: frame.executesRotation,
        hold: !frame.executesRotation,
        terminal: frame.terminal,
        pauseReference: frame.pauseReference
      }
    });
  }

  function snapshot(rows, tableAngle, options = {}) {
    const prepared = prepare(rows, options);
    return snapshotPrepared(prepared, tableAngle, options.preferredHmi);
  }

  global.Labeler3DSimulationFrameDriver = Object.freeze({
    SCHEMA_VERSION,
    PRODUCTION_ROTATION_COMMAND,
    normalizeAngle,
    isProductionRotationCommand,
    prepare,
    snapshotPrepared,
    snapshot
  });
})(window);
