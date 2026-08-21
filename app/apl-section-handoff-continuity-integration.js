"use strict";

(function installAplSectionHandoffContinuity(global) {
  if (global.LabelerAplSectionHandoffContinuity?.installed) return;

  const VERSION = 4;
  const EPS = 0.001;
  const RETRY_MS = 25;
  let installed = false;

  const finite = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const done = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(finite(value, 0) * 10) / 10;

  function runtimeState() {
    try {
      if (typeof state !== "undefined" && state) return state;
    } catch {
      // Fall back to a Window property only when the lexical binding is unavailable.
    }
    return global.state || null;
  }

  function isSectionHandoffTurn(row) {
    if (Number(row?.cmd) !== 7) return false;
    if (row?.applicationTransition === true || row?.wipeResetTransition === true) return true;
    const action = String(row?.action || "");
    return /^Orient\s+(?:Neck|Body|Back)\s+(?:to\s+Tack\s+Reference|for\s+Re-Wipe)/i.test(action);
  }

  function isPassiveReferenceRest(row) {
    if (Number(row?.cmd) !== 3 || row?.canonicalSectionHandoffV44 !== true) return false;
    if (row?.applicationReference === true || row?.wipeResetReference === true) return true;
    const action = String(row?.action || "");
    return /^Hold\s+for\s+(?:Neck|Body|Back)\s+Application\b/i.test(action)
      || /^Orient\s+(?:Neck|Body|Back)\s+for\s+Re-Wipe\b/i.test(action);
  }

  function referenceEvent(row) {
    return {
      tableAngle: done(row?.tableAngle),
      plateAngle: done(row?.plateAngle),
      action: String(row?.action || ""),
      station: Number.isFinite(finite(row?.station, NaN)) ? Number(row.station) : undefined,
      section: String(row?.section || "").toLowerCase() || undefined,
      applicationReference: row?.applicationReference === true,
      applicationReferenceMode: row?.applicationReferenceMode,
      wipeResetReference: row?.wipeResetReference === true,
      finishedLabelCenterlineDeg: Number.isFinite(finite(row?.finishedLabelCenterlineDeg, NaN))
        ? done(row.finishedLabelCenterlineDeg)
        : undefined,
      motionSource: row?.motionSource || "canonical-section-handoff-v44",
      canonicalSectionHandoffV44: true
    };
  }

  function preserveReferenceMetadata(previous, removed) {
    const event = referenceEvent(removed);
    previous.logicalReferenceEvents = [
      ...(Array.isArray(previous.logicalReferenceEvents) ? previous.logicalReferenceEvents : []),
      event
    ];
    previous.canonicalSectionHandoffV44 = true;
    previous.passiveReferenceRestCollapsedV59 = true;

    if (event.applicationReference) {
      previous.applicationReferenceEvents = [
        ...(Array.isArray(previous.applicationReferenceEvents) ? previous.applicationReferenceEvents : []),
        event
      ];
      previous.applicationReference = true;
      previous.applicationReferenceTableAngle = event.tableAngle;
      previous.applicationReferenceStation = event.station;
      previous.applicationReferenceAction = event.action;
      previous.applicationReferenceMode = event.applicationReferenceMode;
      previous.applicationSection = event.section;
      previous.applicationTargetSection = event.section;
      if (Number.isFinite(event.finishedLabelCenterlineDeg)) {
        previous.finishedLabelCenterlineDeg = event.finishedLabelCenterlineDeg;
      }
    }

    if (event.wipeResetReference) {
      previous.wipeResetReferenceEvents = [
        ...(Array.isArray(previous.wipeResetReferenceEvents) ? previous.wipeResetReferenceEvents : []),
        event
      ];
      previous.wipeResetReference = true;
      previous.wipeResetReferenceTableAngle = event.tableAngle;
      previous.wipeResetReferenceStation = event.station;
      previous.wipeResetReferenceAction = event.action;
      previous.wipeResetSection = event.section;
    }

    return event;
  }

  function collapseRedundantReferenceRests(sourceRows) {
    const output = [];
    const collapsed = [];

    (Array.isArray(sourceRows) ? sourceRows : []).forEach((sourceRow) => {
      const row = { ...sourceRow };
      const previous = output.at(-1);
      const previousPlate = finite(previous?.plateAngle, NaN);
      const currentPlate = finite(row?.plateAngle, NaN);
      const samePlate = Number.isFinite(previousPlate)
        && Number.isFinite(currentPlate)
        && Math.abs(previousPlate - currentPlate) <= EPS;

      if (previous
        && Number(previous?.cmd) === 3
        && isPassiveReferenceRest(row)
        && samePlate) {
        const event = preserveReferenceMetadata(previous, row);
        collapsed.push({
          removedHmi: row.hmi,
          retainedHmi: previous.hmi,
          retainedAction: String(previous.action || ""),
          referenceAction: event.action,
          referenceTableAngle: event.tableAngle,
          plateAngle: event.plateAngle,
          station: event.station,
          section: event.section,
          applicationReference: event.applicationReference,
          wipeResetReference: event.wipeResetReference
        });
        return;
      }

      output.push(row);
    });

    return { rows: output, collapsed };
  }

  function recompute(rows) {
    return rows.map((row, index) => {
      const next = rows[index + 1];
      const updated = { ...row, hmi: index + 1, plc: index };
      if (Number(updated?.cmd) !== 7 || !next) return updated;
      const startPlate = finite(updated?.plateAngle, NaN);
      const targetPlate = finite(next?.plateAngle, NaN);
      const tableStart = finite(updated?.tableAngle, NaN);
      const tableStop = finite(next?.tableAngle, NaN);
      if (Number.isFinite(startPlate) && Number.isFinite(targetPlate)) {
        updated.plannedRotation = targetPlate - startPlate;
      }
      if (Number.isFinite(startPlate)
        && Number.isFinite(targetPlate)
        && Number.isFinite(tableStart)
        && Number.isFinite(tableStop)
        && tableStop > tableStart + EPS) {
        updated.plannedRatio = Math.abs(targetPlate - startPlate) / (tableStop - tableStart);
      }
      return updated;
    });
  }

  function repair(sourceRows) {
    const collapsedResult = collapseRedundantReferenceRests(sourceRows);
    const rows = collapsedResult.rows;
    const changes = [];

    for (let index = 1; index < rows.length; index += 1) {
      const row = rows[index];
      const previous = rows[index - 1];
      if (!isSectionHandoffTurn(row) || Number(previous?.cmd) !== 3) continue;

      const previousPlate = finite(previous?.plateAngle, NaN);
      const currentPlate = finite(row?.plateAngle, NaN);
      if (!Number.isFinite(previousPlate) || !Number.isFinite(currentPlate)) continue;

      const correctedStart = done(previousPlate);
      const generatedPlate = finite(row?.generatedPlateAngle, NaN);
      const manualPlateOverride = Number.isFinite(finite(row?.plateAngleOverride, NaN));
      const effectiveNeedsRepair = !manualPlateOverride
        && Math.abs(currentPlate - correctedStart) > EPS;
      const generatedNeedsRepair = Number.isFinite(generatedPlate)
        && Math.abs(generatedPlate - correctedStart) > EPS;
      if (!effectiveNeedsRepair && !generatedNeedsRepair) continue;

      if (effectiveNeedsRepair) row.plateAngle = correctedStart;
      if (generatedNeedsRepair) row.generatedPlateAngle = correctedStart;
      row.sectionHandoffContinuityV56 = true;
      row.generatedHandoffAngleAuthorityV60 = true;
      row.continuitySourceHmi = previous.hmi ?? index;

      const next = rows[index + 1];
      const targetPlate = finite(next?.plateAngle, NaN);
      const effectiveStart = finite(row?.plateAngle, correctedStart);
      const tableStart = finite(row?.tableAngle, NaN);
      const tableStop = finite(next?.tableAngle, NaN);
      if (Number.isFinite(targetPlate)) row.plannedRotation = targetPlate - effectiveStart;
      if (Number.isFinite(targetPlate)
        && Number.isFinite(tableStart)
        && Number.isFinite(tableStop)
        && tableStop > tableStart + EPS) {
        row.plannedRatio = Math.abs(targetPlate - effectiveStart) / (tableStop - tableStart);
      }

      changes.push({
        hmi: row.hmi ?? index + 1,
        action: String(row.action || ""),
        previousPlateAngle: done(currentPlate),
        previousGeneratedPlateAngle: Number.isFinite(generatedPlate) ? done(generatedPlate) : undefined,
        correctedPlateAngle: correctedStart,
        generatedPlateAngleSynchronized: generatedNeedsRepair,
        manualPlateOverridePreserved: manualPlateOverride,
        sourceRestHmi: previous.hmi ?? index
      });
    }

    return {
      rows: recompute(rows),
      changes,
      collapsed: collapsedResult.collapsed
    };
  }

  function synchronizeTranslatedPlan(current, rows) {
    const translationService = global.LabelerProfileTranslationService;
    if (current.motionTranslation && typeof translationService?.syncTranslatedRows === "function") {
      translationService.syncTranslatedRows(current.motionTranslation, rows);
    }
    if (current.motionTranslation?.plan?.steps) {
      current.motionPlan.planner = current.motionTranslation.plan;
      if (current.motionPlan.translation && typeof current.motionPlan.translation === "object") {
        current.motionPlan.translation.commandSummary = current.motionTranslation.commandSummary;
      }
    }
  }

  function synchronize(result) {
    const current = runtimeState();
    if (!current || !Array.isArray(result?.rows)) return result?.rows || [];
    current.program = result.rows;
    current.motionPlan = current.motionPlan && typeof current.motionPlan === "object"
      ? current.motionPlan
      : {};
    current.motionPlan.rows = result.rows;
    synchronizeTranslatedPlan(current, result.rows);
    current.motionPlan.aplSectionHandoffContinuity = {
      version: VERSION,
      applied: result.changes.length > 0 || result.collapsed.length > 0,
      changes: result.changes,
      collapsedPassiveRests: result.collapsed,
      collapsedPassiveRestCount: result.collapsed.length
    };
    current.motionPlan.logicalReferenceEvents = result.rows.flatMap((row) =>
      Array.isArray(row?.logicalReferenceEvents) ? row.logicalReferenceEvents : []
    );
    return result.rows;
  }

  function install() {
    if (installed) return true;
    const current = runtimeState();
    if (!current || typeof global.applyGeneratedServoProfile !== "function") return false;

    const base = global.applyGeneratedServoProfile;
    if (base.aplSectionHandoffContinuityV60 === true) {
      installed = true;
      return true;
    }

    const wrapped = function applyGeneratedServoProfileWithSectionHandoffContinuity(...args) {
      const output = base.apply(this, args);
      const source = Array.isArray(current.program) && current.program.length
        ? current.program
        : output;
      return synchronize(repair(source));
    };
    wrapped.aplSectionHandoffContinuityV59 = true;
    wrapped.aplSectionHandoffContinuityV60 = true;
    wrapped.previousApplyGeneratedServoProfile = base;
    global.applyGeneratedServoProfile = wrapped;

    global.LabelerAplSectionHandoffContinuity = Object.freeze({
      installed: true,
      version: VERSION,
      isSectionHandoffTurn,
      isPassiveReferenceRest,
      collapseRedundantReferenceRests,
      repair
    });
    installed = true;

    try {
      global.applyGeneratedServoProfile();
      global.renderProgram?.();
      global.renderValidation?.();
    } catch (error) {
      console.error("Unable to apply APL section handoff continuity.", error);
    }
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
