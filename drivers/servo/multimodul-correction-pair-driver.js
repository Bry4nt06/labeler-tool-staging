"use strict";

(function installMultiModulCorrectionPairDriver(global) {
  if (global.LabelerMultiModulCorrectionPairDriver) return;

  const REST = 3;
  const CORRECTION = 7;
  const DEFAULT_REFERENCE_SPACING_DEG = 0.5;

  function finite(value, fallback = NaN) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function referenceSpacing(endpointTable, followingTable, requestedSpacing) {
    const gap = followingTable - endpointTable;
    if (!Number.isFinite(gap) || gap <= 0) return requestedSpacing;
    return Math.min(requestedSpacing, Math.max(0.001, gap / 2));
  }

  function correctionReference(row, endpointTable, endpointPlate) {
    const stage = String(row?.stage || "correction");
    return {
      ...row,
      cmd: REST,
      baseCmd: REST,
      tableAngle: endpointTable,
      plateAngle: endpointPlate,
      action: `${String(row?.action || "Correction")} - Reference`,
      stage: `${stage}-reference`,
      plannerIntent: "HOLD",
      plannerRequestedCommand: REST,
      plannerRecommendedCommand: REST,
      machineGrammarInsertedReference: true,
      correctionReferenceForAction: String(row?.action || "Correction")
    };
  }

  function normalize(sourceRows, options = {}) {
    if (!Array.isArray(sourceRows) || sourceRows.length < 2) {
      return { rows: sourceRows, repairs: [] };
    }

    const requestedSpacing = Math.max(0.001, finite(options.referenceSpacingDeg, DEFAULT_REFERENCE_SPACING_DEG));
    const rows = sourceRows.map((row) => ({ ...row }));
    const repairs = [];

    let index = 0;
    while (index < rows.length - 1) {
      const current = rows[index];
      const next = rows[index + 1];
      if (Number(current?.cmd) !== CORRECTION || Number(next?.cmd) !== CORRECTION) {
        index += 1;
        continue;
      }

      const endpointTable = finite(next?.tableAngle, NaN);
      const endpointPlate = finite(next?.plateAngle, NaN);
      if (!Number.isFinite(endpointTable) || !Number.isFinite(endpointPlate)) {
        index += 1;
        continue;
      }

      const following = rows[index + 2];
      const followingTable = finite(following?.tableAngle, NaN);
      const spacing = referenceSpacing(endpointTable, followingTable, requestedSpacing);
      const shiftedTable = endpointTable + spacing;
      const reference = correctionReference(current, endpointTable, endpointPlate);
      const shifted = {
        ...next,
        tableAngle: shiftedTable,
        machineGrammarReferenceStart: true,
        correctionReferenceSpacingDeg: spacing
      };

      const plannedRotation = finite(shifted?.plannedRotation, NaN);
      if (Number.isFinite(plannedRotation) && Number.isFinite(followingTable) && followingTable > shiftedTable) {
        shifted.plannedRatio = Math.abs(plannedRotation) / Math.max(0.001, followingTable - shiftedTable);
      }

      rows.splice(index + 1, 1, reference, shifted);
      repairs.push({
        index,
        strategy: "insert-cmd3-between-cmd7",
        referenceTableAngle: endpointTable,
        referencePlateAngle: endpointPlate,
        shiftedCorrectionTableAngle: shiftedTable,
        spacingDeg: spacing,
        firstAction: String(current?.action || ""),
        secondAction: String(next?.action || "")
      });

      index += 2;
    }

    return {
      rows: rows.map((row, rowIndex) => ({ ...row, hmi: rowIndex + 1, plc: rowIndex })),
      repairs
    };
  }

  const api = Object.freeze({
    REST,
    CORRECTION,
    DEFAULT_REFERENCE_SPACING_DEG,
    normalize
  });

  global.LabelerMultiModulCorrectionPairDriver = api;
  global.LabelerDriverRegistry?.register?.("servo.multimodulCorrectionPair", api, {
    version: 1,
    responsibilities: ["multimodul-cmd7-reference-isolation", "autocol-style-correction-pairs"]
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
