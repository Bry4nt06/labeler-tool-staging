"use strict";

(function installTopModulCoderTerminalSourcePolicy(global) {
  if (global.LabelerTopModulCoderTerminalSourcePolicy?.installed) return;

  const STAGE_ID = "terminal.topmodul-coder";
  const STAGE_ORDER = 550;
  const RETRY_MS = 25;
  const EPS = 0.001;
  let installed = false;

  const number = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(number(value, 0) * 10) / 10;

  function pipelineDriver() {
    return global.LabelerDriverRegistry?.resolve("profile.pipeline")
      || global.LabelerProfilePipelineDriver
      || null;
  }

  function activeMap() {
    try { return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null; }
    catch { return null; }
  }

  function isTopModul(map = activeMap()) {
    const identity = String(map?.machineType || map?.name || "").toUpperCase();
    if (identity.includes("TOPMODUL")) return true;
    return String(global.state?.machineFamilyGrammar?.family || "").toUpperCase() === "TOPMODUL";
  }

  function activeCoder(map = activeMap()) {
    return (Array.isArray(map?.objects) ? map.objects : [])
      .find((item) => item?.kind === "coding"
        && item?.enabled !== false
        && item?.orientBottle !== false
        && item?.disableServoOrientation !== true) || null;
  }

  function coderIds(row = {}) {
    return [
      row.codingObjectId,
      row.orientationObjectId,
      ...(Array.isArray(row.codingObjectIds) ? row.codingObjectIds : []),
      ...(Array.isArray(row.orientationObjectIds) ? row.orientationObjectIds : [])
    ].filter((value) => value !== null && value !== undefined && value !== "").map(String);
  }

  function codingRelated(row, coder = activeCoder()) {
    if (!row) return false;
    const coderId = String(coder?.id || "");
    const ids = coderIds(row);
    const action = String(row.action || "");
    return row.codingHold === true
      || row.codingMotion === true
      || row.explicitCodingWindowHold === true
      || row.coderAfterWipeHandoff === true
      || row.coderAfterWipeContinuation === true
      || row.codeBoxDirectionCorrected === true
      || (coderId && ids.includes(coderId))
      || /coding|code\s*box|coder/i.test(action);
  }

  function genericTerminal(row) {
    return row?.terminalRest === true
      || /end\s*(?:of\s*)?curve/i.test(String(row?.action || ""));
  }

  function codingPlanTarget(coder) {
    const target = global.state?.motionPlan?.coderCenterlineTarget;
    if (Number.isFinite(number(target, NaN))) return number(target);

    const plans = [
      ...(Array.isArray(global.state?.motionPlan?.orientationConstraintPlans)
        ? global.state.motionPlan.orientationConstraintPlans
        : []),
      ...(Array.isArray(global.state?.motionPlan?.mapObjectOrientationPlans)
        ? global.state.motionPlan.mapObjectOrientationPlans
        : [])
    ];
    const coderId = String(coder?.id || "");
    const plan = [...plans].reverse().find((entry) =>
      String(entry?.objectId || entry?.codingObjectId || "") === coderId
      || entry?.kind === "coding");
    return number(plan?.targetPlateAngle, NaN);
  }

  function codingTarget(rows, coder) {
    const planned = codingPlanTarget(coder);
    if (Number.isFinite(planned)) return planned;

    const candidates = (Array.isArray(rows) ? rows : [])
      .filter((row) => codingRelated(row, coder) && Number.isFinite(number(row?.plateAngle, NaN)))
      .map((row) => {
        const action = String(row?.action || "");
        let score = 0;
        if (row?.codingHold === true || row?.explicitCodingWindowHold === true) score += 100;
        if (Number(row?.cmd) === 3) score += 30;
        if (/hold.*(?:coding|code\s*box)|(?:coding|code\s*box).*hold/i.test(action)) score += 25;
        if (row?.codeBoxDirectionCorrected === true) score += 20;
        return { row, score, table: number(row?.tableAngle, -Infinity) };
      })
      .sort((left, right) => right.score - left.score || right.table - left.table);
    return number(candidates[0]?.row?.plateAngle, NaN);
  }

  function finalProcessReference(rows, coderStart, coder) {
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => {
        const table = number(row?.tableAngle, NaN);
        return Number.isFinite(table)
          && table < coderStart - EPS
          && Number.isFinite(number(row?.plateAngle, NaN))
          && !codingRelated(row, coder)
          && !genericTerminal(row);
      })
      .sort((left, right) => number(left?.tableAngle, 0) - number(right?.tableAngle, 0))
      .at(-1) || null;
  }

  function existingCodingTurn(rows, processReference, coderStart, coder) {
    const processTable = number(processReference?.tableAngle, -Infinity);
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => {
        const table = number(row?.tableAngle, NaN);
        return Number(row?.cmd) === 7
          && codingRelated(row, coder)
          && Number.isFinite(table)
          && table > processTable + EPS
          && table < coderStart - EPS;
      })
      .sort((left, right) => number(left?.tableAngle, 0) - number(right?.tableAngle, 0))[0] || null;
  }

  function sourceCodingHold(rows, coder) {
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => codingRelated(row, coder) && Number.isFinite(number(row?.plateAngle, NaN)))
      .sort((left, right) => {
        const leftScore = (left?.codingHold === true ? 100 : 0) + (Number(left?.cmd) === 3 ? 20 : 0);
        const rightScore = (right?.codingHold === true ? 100 : 0) + (Number(right?.cmd) === 3 ? 20 : 0);
        return rightScore - leftScore || number(right?.tableAngle, 0) - number(left?.tableAngle, 0);
      })[0] || {};
  }

  function synchronize(rows, coder, coderStart, coderEnd) {
    if (!global.state) return rows;
    global.state.program = rows;
    const finalRow = rows.at(-1);
    global.state.motionPlan = global.state.motionPlan && typeof global.state.motionPlan === "object"
      ? global.state.motionPlan
      : {};
    Object.assign(global.state.motionPlan, {
      rows,
      finalPlateAngle: finalRow?.plateAngle,
      coderTerminalSourcePolicy: true,
      coderTerminalSourceStage: STAGE_ID,
      coderPhysicalStartTableAngle: coderStart,
      coderPhysicalEndTableAngle: coderEnd,
      coderTerminalObjectId: coder?.id,
      termination: {
        ...(global.state.motionPlan.termination || {}),
        section: "coding",
        hmi: finalRow?.hmi,
        tableAngle: finalRow?.tableAngle,
        command: "Rest"
      }
    });
    return rows;
  }

  function canonicalize(sourceRows) {
    const rows = Array.isArray(sourceRows) ? sourceRows.map((row) => ({ ...row })) : [];
    const map = activeMap();
    const coder = activeCoder(map);
    if (!rows.length || !map || !coder || !isTopModul(map)) return rows;

    const coderStart = number(coder.start, number(coder.angle, NaN));
    let coderEnd = number(coder.end, coderStart + Math.max(0.5, number(coder.wipeSpanDeg, 5)));
    if (!Number.isFinite(coderStart)) return rows;
    while (coderEnd <= coderStart) coderEnd += 360;

    const targetPlate = codingTarget(rows, coder);
    const processReference = finalProcessReference(rows, coderStart, coder);
    if (!Number.isFinite(targetPlate) || !processReference) return rows;

    const currentPlate = number(processReference.plateAngle, targetPlate);
    const processTable = number(processReference.tableAngle, NaN);
    const oldTurn = existingCodingTurn(rows, processReference, coderStart, coder);
    let turnStart = number(oldTurn?.tableAngle, processTable + 0.5);
    if (!Number.isFinite(turnStart) || turnStart <= processTable + EPS || turnStart >= coderStart - EPS) {
      turnStart = processTable + 0.5;
    }

    const maxRatio = Math.max(0.1, number(global.state?.maxMoveRatio, number(map?.machineSettings?.maxMoveRatio, 21)));
    const rotation = targetPlate - currentPlate;
    const availableSpan = coderStart - turnStart;
    const ratio = Math.abs(rotation) / Math.max(EPS, availableSpan);

    // If the inherited start is too late to finish by the physical coder, use
    // every available degree after the last completed physical process. Never
    // solve a capacity problem by extending the correction through the coder or
    // out to the synthetic 359° terminal row.
    if (Math.abs(rotation) > EPS && ratio >= maxRatio) {
      turnStart = processTable + 0.5;
    }

    const canonicalRatio = Math.abs(rotation) / Math.max(EPS, coderStart - turnStart);
    const prefix = rows
      .filter((row) => {
        const table = number(row?.tableAngle, NaN);
        if (!Number.isFinite(table)) return true;
        if (table >= turnStart - EPS) return false;
        if (genericTerminal(row)) return false;
        return true;
      })
      .sort((left, right) => number(left?.tableAngle, 0) - number(right?.tableAngle, 0));

    const output = [...prefix];
    if (Math.abs(rotation) > EPS) {
      output.push({
        ...(oldTurn || {}),
        cmd: 7,
        baseCmd: 7,
        tableAngle: done(turnStart),
        generatedTableAngle: done(turnStart),
        plateAngle: done(currentPlate),
        action: oldTurn?.action && /coding|code\s*box|coder/i.test(String(oldTurn.action))
          ? oldTurn.action
          : "Orient Back Code Box for Coding",
        section: oldTurn?.section || "back",
        codingMotion: true,
        codingHold: false,
        activeHold: false,
        codingObjectId: coder.id,
        codingObjectIds: [coder.id],
        orientationObjectId: coder.id,
        orientationObjectIds: [coder.id],
        codingWindowStart: done(coderStart),
        codingWindowStop: done(coderEnd),
        physicalCodingWindowStart: done(coderStart),
        coderStartTableAngle: done(coderStart),
        plannedRotation: done(rotation),
        plannedRatio: canonicalRatio,
        terminalRest: false,
        plannerIntent: "ROTATE",
        plannerRequestedCommand: 7,
        plannerRecommendedCommand: 7,
        motionSource: "topmodul-coder-terminal-source-policy"
      });
    }

    const priorHold = sourceCodingHold(rows, coder);
    output.push({
      ...priorHold,
      cmd: 3,
      baseCmd: 3,
      tableAngle: done(coderStart),
      generatedTableAngle: done(coderStart),
      plateAngle: done(targetPlate),
      action: "Hold for Coding",
      section: priorHold?.section || oldTurn?.section || "back",
      codingHold: true,
      codingMotion: false,
      activeHold: false,
      explicitCodingWindowHold: true,
      orientationHold: true,
      codingObjectId: coder.id,
      codingObjectIds: [coder.id],
      orientationObjectId: coder.id,
      orientationObjectIds: [coder.id],
      codingReadyTableAngle: done(coderStart),
      codingWindowStart: done(coderStart),
      codingWindowStop: done(coderEnd),
      physicalCodingWindowStart: done(coderStart),
      coderStartTableAngle: done(coderStart),
      preCoderMarginDeg: 0,
      terminalRest: true,
      plannerIntent: "HOLD",
      plannerRequestedCommand: 3,
      plannerRecommendedCommand: 3,
      motionSource: "topmodul-coder-terminal-source-policy",
      topModulPhysicalCoderTerminal: true
    });

    const finalized = output
      .sort((left, right) => number(left?.tableAngle, 0) - number(right?.tableAngle, 0))
      .map((row, index) => ({ ...row, hmi: index + 1, plc: index }));

    synchronize(finalized, coder, done(coderStart), done(coderEnd));
    return finalized;
  }

  function registerStage() {
    const pipeline = pipelineDriver();
    if (!pipeline?.registerStage) return false;
    pipeline.registerStage({
      id: STAGE_ID,
      phase: "terminal",
      order: STAGE_ORDER,
      source: "app/topmodul-coder-terminal-source-policy-integration.js",
      description: "Make the physical TopModul coder start the terminal CMD 3 destination before grammar derives segment commands.",
      process: canonicalize
    });
    return true;
  }

  function install() {
    if (installed) return true;
    if (!global.state || !registerStage()) return false;
    global.LabelerTopModulCoderTerminalSourcePolicy = Object.freeze({
      installed: true,
      version: 1,
      stageId: STAGE_ID,
      stageOrder: STAGE_ORDER,
      codingRelated,
      genericTerminal,
      codingTarget,
      finalProcessReference,
      canonicalize
    });
    installed = true;

    try {
      if (global.LabelerProfilePipelineOrchestratorInstalled === true
        && typeof global.applyGeneratedServoProfile === "function") {
        global.applyGeneratedServoProfile();
        if (typeof global.render === "function") global.render();
      }
    } catch (error) {
      console.error("Unable to apply the TopModul coder terminal source policy.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", wait, { once: true });
  } else wait();
})(typeof window !== "undefined" ? window : globalThis);
