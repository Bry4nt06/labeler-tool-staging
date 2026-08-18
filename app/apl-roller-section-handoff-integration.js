"use strict";

(function installAplRollerSectionHandoff(global) {
  if (global.LabelerAplRollerSectionHandoff?.installed) return;

  const VERSION = 1;
  const EPS = 0.001;

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

  function isNeckTurn2(row) {
    return Number(row?.cmd) === 7
      && (text(row?.section).toLowerCase() === "neck" || /\bneck\b/i.test(text(row?.action)))
      && /\bwipe\s+turn\s+2\b/i.test(text(row?.action));
  }

  function isBodyApplicationTransition(turn, reference) {
    if (Number(turn?.cmd) !== 7 || Number(reference?.cmd) !== 3) return false;
    const section = text(turn?.section || reference?.section).toLowerCase();
    const action = `${text(turn?.action)} ${text(reference?.action)}`;
    const body = section === "body" || /\bbody\b/i.test(action);
    const application = turn?.applicationTransition === true
      || reference?.applicationReference === true
      || /application|tack\s+reference/i.test(action);
    return body && application;
  }

  function stationUsesRollers(station) {
    const map = activeMap();
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
      section: text(reference?.section).toLowerCase() || "body",
      applicationReference: true,
      motionSource: "apl-roller-section-handoff-v1"
    };
  }

  function repair(sourceRows, maximumRatio = null) {
    const rows = (Array.isArray(sourceRows) ? sourceRows : []).map((row) => ({ ...row }));
    const current = runtimeState();
    const maxRatio = Math.max(0.1, finite(maximumRatio, finite(current?.maxMoveRatio, 21)));
    const changes = [];

    for (let index = 0; index < rows.length - 3; index += 1) {
      const wipeTurn = rows[index];
      const wipeRest = rows[index + 1];
      const transitionTurn = rows[index + 2];
      const transitionReference = rows[index + 3];

      if (!isNeckTurn2(wipeTurn) || Number(wipeRest?.cmd) !== 3) continue;
      if (!isBodyApplicationTransition(transitionTurn, transitionReference)) continue;
      if (!stationUsesRollers(wipeTurn.station)) continue;

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
      if (Math.abs(transitionTravel) <= EPS || transitionRatio < maxRatio) continue;

      const originalWipeTravel = wipeStopPlate - wipeStartPlate;
      const wipeDirection = Math.sign(originalWipeTravel);
      if (!wipeDirection) continue;

      const mergedTarget = sameDirectionEquivalent(targetPlate, wipeStartPlate, wipeDirection);
      if (!Number.isFinite(mergedTarget)) continue;
      const mergedTravel = mergedTarget - wipeStartPlate;
      if (Math.sign(mergedTravel) !== wipeDirection) continue;

      const wipeSpan = wipeStopTable - wipeStartTable;
      if (wipeSpan <= EPS) continue;
      const mergedRatio = Math.abs(mergedTravel) / wipeSpan;
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

    return { rows: refreshMetrics(rows), changes };
  }

  function synchronize(result) {
    const current = runtimeState();
    if (!current || !Array.isArray(result?.rows)) return result?.rows || [];
    current.program = result.rows;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object" ? current.motionPlan : {};
    current.motionPlan.rows = result.rows;
    current.motionPlan.aplRollerSectionHandoff = {
      version: VERSION,
      applied: result.changes.length > 0,
      changes: result.changes
    };

    try {
      const translationService = global.LabelerProfileTranslationService;
      if (current.motionTranslation && typeof translationService?.syncTranslatedRows === "function") {
        translationService.syncTranslatedRows(current.motionTranslation, result.rows);
      }
    } catch { }

    return result.rows;
  }

  function install() {
    const base = global.applyGeneratedServoProfile;
    if (typeof base !== "function") return false;
    if (base.aplRollerSectionHandoffV1 === true) return true;

    const wrapped = function applyGeneratedServoProfileWithRollerSectionHandoff(...args) {
      const output = base.apply(this, args);
      const current = runtimeState();
      const source = Array.isArray(current?.program) && current.program.length
        ? current.program
        : Array.isArray(output) ? output : [];
      const result = repair(source);
      return result.changes.length ? synchronize(result) : output;
    };
    wrapped.aplRollerSectionHandoffV1 = true;
    wrapped.previousApplyGeneratedServoProfile = base;
    global.applyGeneratedServoProfile = wrapped;

    global.LabelerAplRollerSectionHandoff = Object.freeze({
      installed: true,
      version: VERSION,
      repair,
      synchronize,
      sameDirectionEquivalent
    });
    return true;
  }

  if (!install()) global.setTimeout(install, 25);
})(typeof window !== "undefined" ? window : globalThis);
