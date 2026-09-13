"use strict";

(function installAplRollerSectionHandoff(global) {
  if (global.LabelerAplRollerSectionHandoff?.version >= 2) return;

  const VERSION = 2;
  const STAGE_ID = "apl.roller-section-handoff";
  const EPS = 0.001;
  const RETRY_MS = 25;

  const finite = (value, fallback = NaN) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(finite(value, 0) * 10) / 10;

  const text = (value) => String(value ?? "").trim();

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch { }
    return global.state || null;
  }

  function activeMap() {
    try {
      return typeof global.activeMachineMap === "function" ? global.activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function pipelineDriver() {
    return global.LabelerDriverRegistry?.resolve?.("profile.pipeline")
      || global.LabelerProfilePipelineDriver
      || null;
  }

  function rowSection(row) {
    const explicit = text(row?.section).toLowerCase();
    if (["neck", "body", "back"].includes(explicit)) return explicit;
    const match = text(row?.action).match(/\b(Neck|Body|Back)\b/i);
    return match ? match[1].toLowerCase() : "";
  }

  function isNeckTurn2(row) {
    return Number(row?.cmd) === 7
      && rowSection(row) === "neck"
      && /\bwipe\s+turn\s+2\b/i.test(text(row?.action));
  }

  function isBodyWipeStart(row) {
    return Number(row?.cmd) === 7
      && rowSection(row) === "body"
      && /\bwipe\s+turn\s+1\b/i.test(text(row?.action));
  }

  function samePhysicalAngle(left, right, tolerance = 0.15) {
    const a = finite(left, NaN);
    const b = finite(right, NaN);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    let delta = (a - b) % 360;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    return Math.abs(delta) <= tolerance;
  }

  function findImmediateBodyWipe(rows, referenceIndex) {
    const reference = rows[referenceIndex];
    const referenceTable = finite(reference?.tableAngle, NaN);
    const referencePlate = finite(reference?.plateAngle, NaN);
    if (!Number.isFinite(referenceTable) || !Number.isFinite(referencePlate)) return null;

    for (let index = referenceIndex + 1; index < Math.min(rows.length, referenceIndex + 4); index += 1) {
      const row = rows[index];
      const table = finite(row?.tableAngle, NaN);
      if (!Number.isFinite(table) || table < referenceTable - EPS) continue;
      if (table - referenceTable > 2.5 + EPS) break;
      if (!isBodyWipeStart(row)) continue;
      if (!samePhysicalAngle(row.plateAngle, referencePlate)) continue;
      return { row, index };
    }
    return null;
  }

  function isBodyApplicationTransition(rows, turnIndex) {
    const turn = rows[turnIndex];
    const reference = rows[turnIndex + 1];
    if (Number(turn?.cmd) !== 7 || Number(reference?.cmd) !== 3) return false;

    const bodyByMetadata = rowSection(turn) === "body"
      || rowSection(reference) === "body"
      || turn?.applicationTransition === true
      || reference?.applicationReference === true
      || /\bbody\b/i.test(`${text(turn?.action)} ${text(reference?.action)}`);
    const applicationByMetadata = turn?.applicationTransition === true
      || reference?.applicationReference === true
      || /application|tack\s+reference/i.test(`${text(turn?.action)} ${text(reference?.action)}`);
    if (bodyByMetadata && applicationByMetadata) return true;

    // Some late orientation stages strip the application metadata while
    // leaving the physical row sequence intact. In that case, the transition
    // is authoritative when its reference is immediately followed by Body
    // Wipe Turn 1 at the same bottle orientation.
    return Boolean(findImmediateBodyWipe(rows, turnIndex + 1));
  }

  function stationUsesRollers(station, machineMap = activeMap()) {
    const map = machineMap;
    if (!map) return false;
    const objects = (Array.isArray(map.objects) ? map.objects : [])
      .filter((item) => item?.application !== "cold-glue")
      .filter((item) => Number(item?.station) === Number(station))
      .filter((item) => item?.kind === "roller" || item?.kind === "pad");
    if (!objects.length || objects.some((item) => item.kind === "pad")) return false;
    return objects.some((item) => item.kind === "roller");
  }

  function sameDirectionEquivalent(target, start, direction) {
    const candidates = [];
    for (let turn = -6; turn <= 6; turn += 1) candidates.push(target + turn * 360);
    const directional = candidates.filter((candidate) => {
      const delta = candidate - start;
      return Math.abs(delta) <= EPS || Math.sign(delta) === direction;
    });
    if (!directional.length) return NaN;
    return directional.reduce((best, candidate) =>
      Math.abs(candidate - start) < Math.abs(best - start) - EPS ? candidate : best,
    directional[0]);
  }

  function refreshMetrics(rows) {
    rows.forEach((row, index) => {
      row.hmi = index + 1;
      row.plc = index;
      if (Number(row?.cmd) !== 7) return;
      const next = rows[index + 1];
      if (!next) return;
      const startPlate = finite(row.plateAngle, NaN);
      const stopPlate = finite(next.plateAngle, NaN);
      const startTable = finite(row.tableAngle, NaN);
      const stopTable = finite(next.tableAngle, NaN);
      if (!Number.isFinite(startPlate) || !Number.isFinite(stopPlate)) return;
      const rotation = done(stopPlate - startPlate);
      row.plannedRotation = rotation;
      row.bottleTravel = rotation;
      if (Number.isFinite(startTable) && Number.isFinite(stopTable) && stopTable > startTable + EPS) {
        row.plannedRatio = Math.abs(rotation) / (stopTable - startTable);
      }
    });
    return rows;
  }

  function applicationReferenceEvent(reference) {
    return {
      tableAngle: done(reference?.tableAngle),
      plateAngle: done(reference?.plateAngle),
      action: text(reference?.action),
      station: Number.isFinite(finite(reference?.station, NaN)) ? Number(reference.station) : undefined,
      section: rowSection(reference) || "body",
      applicationReference: true,
      motionSource: "apl-roller-section-handoff-v2"
    };
  }

  function repair(sourceRows, maximumRatio = null, machineMap = activeMap()) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const current = runtimeState();
    const maxRatio = Math.max(0.1, finite(maximumRatio, finite(current?.maxMoveRatio, 21)));
    const changes = [];
    const candidates = [];

    for (let index = 0; index < rows.length - 3; index += 1) {
      const wipeTurn = rows[index];
      const wipeRest = rows[index + 1];
      const transitionTurn = rows[index + 2];
      const transitionReference = rows[index + 3];

      if (!isNeckTurn2(wipeTurn) || Number(wipeRest?.cmd) !== 3) continue;
      if (Number(transitionTurn?.cmd) !== 7 || Number(transitionReference?.cmd) !== 3) continue;

      const candidate = {
        wipeHmi: wipeTurn.hmi ?? index + 1,
        transitionHmi: transitionTurn.hmi ?? index + 3,
        station: Number(wipeTurn.station),
        bodyTransition: isBodyApplicationTransition(rows, index + 2),
        rollerStation: stationUsesRollers(wipeTurn.station, machineMap)
      };
      candidates.push(candidate);

      if (!candidate.bodyTransition || !candidate.rollerStation) continue;

      const wipeStartTable = finite(wipeTurn.tableAngle, NaN);
      const wipeStopTable = finite(wipeRest.tableAngle, NaN);
      const transitionStartTable = finite(transitionTurn.tableAngle, NaN);
      const transitionStopTable = finite(transitionReference.tableAngle, NaN);
      const wipeStartPlate = finite(wipeTurn.plateAngle, NaN);
      const wipeStopPlate = finite(wipeRest.plateAngle, NaN);
      const targetPlate = finite(transitionReference.plateAngle, NaN);
      if (![wipeStartTable, wipeStopTable, transitionStartTable, transitionStopTable, wipeStartPlate, wipeStopPlate, targetPlate].every(Number.isFinite)) continue;

      const gap = transitionStartTable - wipeStopTable;
      if (gap < -EPS || gap > 1.5 + EPS) continue;

      const transitionSpan = transitionStopTable - transitionStartTable;
      const transitionTravel = targetPlate - wipeStopPlate;
      const transitionRatio = Math.abs(transitionTravel) / Math.max(EPS, transitionSpan);
      candidate.transitionRatio = done(transitionRatio);
      if (Math.abs(transitionTravel) <= EPS || transitionRatio < maxRatio) continue;

      const originalWipeTravel = wipeStopPlate - wipeStartPlate;
      const wipeDirection = Math.sign(originalWipeTravel);
      if (!wipeDirection) continue;

      const mergedTarget = sameDirectionEquivalent(targetPlate, wipeStartPlate, wipeDirection);
      if (!Number.isFinite(mergedTarget)) continue;
      const mergedTravel = mergedTarget - wipeStartPlate;
      if (Math.sign(mergedTravel) !== wipeDirection) continue;
      // Optimization may absorb a correction, but never remove physical wiping.
      // Retain the separate correction (and its capacity fault) if merging would
      // stop the neck turn before its already-planned endpoint.
      if (Math.abs(mergedTravel) + EPS < Math.abs(originalWipeTravel)) continue;

      const wipeSpan = wipeStopTable - wipeStartTable;
      if (wipeSpan <= EPS) continue;
      const mergedRatio = Math.abs(mergedTravel) / wipeSpan;
      candidate.mergedRatio = done(mergedRatio);
      if (mergedRatio >= maxRatio) continue;

      const referenceEvent = applicationReferenceEvent(transitionReference);
      wipeRest.plateAngle = done(mergedTarget);
      wipeRest.phaseTransition = "neck-to-body-roller";
      wipeRest.rollerSectionHandoffMerged = true;
      wipeRest.applicationReference = true;
      wipeRest.applicationTargetSection = "body";
      wipeRest.applicationReferenceTableAngle = referenceEvent.tableAngle;
      wipeRest.applicationReferenceStation = referenceEvent.station;
      wipeRest.applicationReferenceAction = referenceEvent.action;
      wipeRest.logicalReferenceEvents = [
        ...(Array.isArray(wipeRest.logicalReferenceEvents) ? wipeRest.logicalReferenceEvents : []),
        referenceEvent
      ];
      wipeRest.applicationReferenceEvents = [
        ...(Array.isArray(wipeRest.applicationReferenceEvents) ? wipeRest.applicationReferenceEvents : []),
        referenceEvent
      ];

      wipeTurn.phaseTransition = "neck-to-body-roller";
      wipeTurn.rollerSectionHandoffMerged = true;
      wipeTurn.originalWipeTravel = done(originalWipeTravel);
      wipeTurn.mergedWipeTravel = done(mergedTravel);
      wipeTurn.originalTransitionTravel = done(transitionTravel);
      wipeTurn.originalTransitionRatio = transitionRatio;
      wipeTurn.mergedWipeRatio = mergedRatio;

      changes.push({
        wipeHmi: wipeTurn.hmi ?? index + 1,
        removedTurnHmi: transitionTurn.hmi ?? index + 3,
        removedReferenceHmi: transitionReference.hmi ?? index + 4,
        station: Number(wipeTurn.station),
        nextStation: Number.isFinite(finite(transitionReference.station, NaN)) ? Number(transitionReference.station) : undefined,
        originalWipeTravel: done(originalWipeTravel),
        mergedWipeTravel: done(mergedTravel),
        originalTransitionTravel: done(transitionTravel),
        originalTransitionRatio: done(transitionRatio),
        mergedRatio: done(mergedRatio),
        targetPlateAngle: done(mergedTarget),
        maxRatio
      });

      rows.splice(index + 2, 2);
      index = Math.max(-1, index - 1);
    }

    return { rows: refreshMetrics(rows), changes, candidates };
  }

  function publish(result, current = runtimeState()) {
    global.ServoForgeAplRollerSectionHandoffLastResult = {
      version: VERSION,
      applied: result.changes.length > 0,
      changes: result.changes,
      candidates: result.candidates
    };
    if (!current) return;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
    current.motionPlan.aplRollerSectionHandoff = {
      version: VERSION,
      applied: result.changes.length > 0,
      changes: result.changes,
      candidates: result.candidates
    };
  }

  function synchronize(result, current = runtimeState()) {
    if (!current || !Array.isArray(result?.rows)) return result?.rows || [];
    current.program = result.rows;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
    current.motionPlan.rows = result.rows;
    publish(result, current);

    try {
      const translationService = global.LabelerProfileTranslationService;
      if (current.motionTranslation && typeof translationService?.syncTranslatedRows === "function") {
        translationService.syncTranslatedRows(current.motionTranslation, result.rows);
      }
    } catch { }

    return result.rows;
  }

  function applyToState() {
    const current = runtimeState();
    if (!current || !Array.isArray(current.program) || !current.program.length) return false;
    const result = repair(current.program, current.maxMoveRatio, activeMap());
    publish(result, current);
    if (!result.changes.length) return false;
    synchronize(result, current);
    return true;
  }

  function processPipeline(rows, context = {}) {
    const current = context.state || runtimeState();
    const map = context.map || activeMap();
    if (String(context.applicationMode || current?.applicationMode || map?.applicationMode || "").toLowerCase() !== "apl") return rows;
    const result = repair(rows, current?.maxMoveRatio, map);
    publish(result, current);
    return result.rows;
  }

  function install() {
    const pipeline = pipelineDriver();
    if (!pipeline?.registerStage) return false;
    pipeline.registerStage({
      id: STAGE_ID,
      phase: "handoff",
      order: 9000,
      source: "app/apl-roller-section-handoff-integration.js",
      description: "Merge a faulting Neck-roller to Body-application correction into the preceding physical roller turn when the combined move remains inside the configured servo ratio limit.",
      process: processPipeline
    });

    global.LabelerAplRollerSectionHandoff = Object.freeze({
      installed: true,
      version: VERSION,
      stageId: STAGE_ID,
      repair,
      applyToState,
      synchronize,
      sameDirectionEquivalent,
      isBodyApplicationTransition,
      findImmediateBodyWipe,
      processPipeline
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
