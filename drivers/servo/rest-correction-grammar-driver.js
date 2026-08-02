"use strict";

(function installRestCorrectionGrammarDriver(global) {
  if (global.LabelerRestCorrectionGrammarDriver) return;

  const DEFAULT_TOLERANCE = 0.5;
  const MOTION_COMMANDS = new Set([1, 2, 4, 5, 6, 7]);

  function finite(value, fallback = NaN) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function isCodingRelease(row) {
    if (Number(row?.cmd) !== 7) return false;
    return row?.codingRelease === true
      || /return bottle.*(?:end curve|reference).*after coding|release.*after coding|continue.*after coder/i.test(String(row?.action || ""));
  }

  function correctionMetrics(startRow, destinationRow, startPlate) {
    const destinationPlate = finite(destinationRow?.plateAngle, NaN);
    const tableTravel = finite(destinationRow?.tableAngle, NaN) - finite(startRow?.tableAngle, NaN);
    return {
      plannedRotation: Number.isFinite(destinationPlate) ? destinationPlate - startPlate : startRow?.plannedRotation,
      plannedRatio: Number.isFinite(destinationPlate) && tableTravel > 0.001
        ? Math.abs(destinationPlate - startPlate) / tableTravel
        : startRow?.plannedRatio
    };
  }

  function repairPreviousMotion(rows, restIndex, restoredPlate) {
    const previous = rows[restIndex - 1];
    if (!previous || !MOTION_COMMANDS.has(Number(previous.cmd))) return;
    const startPlate = finite(previous.plateAngle, NaN);
    const tableTravel = finite(rows[restIndex]?.tableAngle, NaN) - finite(previous.tableAngle, NaN);
    rows[restIndex - 1] = {
      ...previous,
      plannedRotation: Number.isFinite(startPlate) ? restoredPlate - startPlate : previous.plannedRotation,
      plannedRatio: Number.isFinite(startPlate) && tableTravel > 0.001
        ? Math.abs(restoredPlate - startPlate) / tableTravel
        : previous.plannedRatio,
      restGrammarReconciled: true
    };
  }

  function preserveRestThroughFollowingStart(rows, restIndex, heldPlate) {
    for (let index = restIndex + 1; index < rows.length; index += 1) {
      const row = rows[index];
      const originalPlate = finite(row?.plateAngle, NaN);
      rows[index] = {
        ...row,
        plateAngle: heldPlate,
        restGrammarReconciled: true,
        restGrammarStartAligned: true,
        originalRestGrammarStartPlate: originalPlate
      };
      if (Number(row?.cmd) === 3) continue;
      if (MOTION_COMMANDS.has(Number(row?.cmd))) {
        rows[index] = {
          ...rows[index],
          ...correctionMetrics(rows[index], rows[index + 1], heldPlate)
        };
      }
      return index;
    }
    return rows.length - 1;
  }

  function reconcile(sourceRows, options = {}) {
    if (!Array.isArray(sourceRows) || sourceRows.length < 2) {
      return { rows: sourceRows, repairs: [] };
    }

    const tolerance = Math.max(0, finite(options.tolerance, DEFAULT_TOLERANCE));
    const requestedPreserveIndexes = Array.isArray(options.preserveRestIndexes)
      ? options.preserveRestIndexes
      : [];
    const shouldRepair = typeof options.shouldRepair === "function"
      ? options.shouldRepair
      : () => true;
    const rows = sourceRows.map((row) => ({ ...row }));
    const automaticCodingReleaseIndexes = new Set(
      rows.map((row, index) => Number(row?.cmd) === 3 && isCodingRelease(rows[index + 1]) ? index : -1)
        .filter((index) => index >= 0)
    );
    const preserveIndexes = new Set([
      ...requestedPreserveIndexes,
      ...automaticCodingReleaseIndexes
    ]);
    const repairs = [];

    // First align ordinary Rest rows to the next row's starting reference.
    // Work backward so a repaired later reference becomes authoritative for
    // the earlier segment that leads into it.
    for (let index = rows.length - 2; index >= 0; index -= 1) {
      const row = rows[index];
      const next = rows[index + 1];
      if (Number(row?.cmd) !== 3 || preserveIndexes.has(index) || !shouldRepair(row, index, rows)) continue;
      const current = finite(row?.plateAngle, NaN);
      const nextPlate = finite(next?.plateAngle, NaN);
      if (!Number.isFinite(current) || !Number.isFinite(nextPlate)) continue;
      const rejectedTravel = nextPlate - current;
      if (Math.abs(rejectedTravel) <= tolerance) continue;

      rows[index] = {
        ...row,
        plateAngle: nextPlate,
        restGrammarReconciled: true,
        rejectedRestPlateTravel: rejectedTravel,
        originalRestPlateAngle: current
      };
      repairPreviousMotion(rows, index, nextPlate);
      repairs.push({
        index,
        hmi: row?.hmi ?? index + 1,
        strategy: "align-rest-to-next-reference",
        rejectedPlateTravel: rejectedTravel,
        restoredPlateAngle: nextPlate
      });
    }

    // A selected hold, or any Rest directly before a coding-release motion,
    // is authoritative. Keep that achieved bottle angle and propagate it into
    // the start row of the release/continuation move.
    [...preserveIndexes].sort((a, b) => a - b).forEach((index) => {
      const row = rows[index];
      const next = rows[index + 1];
      const automaticCodingRelease = automaticCodingReleaseIndexes.has(index);
      if (!row || !next || Number(row.cmd) !== 3) return;
      if (!automaticCodingRelease && !shouldRepair(row, index, rows)) return;
      const heldPlate = finite(row.plateAngle, NaN);
      const nextPlate = finite(next.plateAngle, NaN);
      if (!Number.isFinite(heldPlate) || !Number.isFinite(nextPlate)) return;
      const rejectedTravel = nextPlate - heldPlate;
      if (Math.abs(rejectedTravel) <= tolerance) return;
      const alignedThroughIndex = preserveRestThroughFollowingStart(rows, index, heldPlate);
      repairs.push({
        index,
        hmi: row?.hmi ?? index + 1,
        strategy: automaticCodingRelease
          ? "preserve-coding-release-handoff"
          : "preserve-rest-target",
        rejectedPlateTravel: rejectedTravel,
        restoredPlateAngle: heldPlate,
        alignedThroughIndex,
        automaticCodingRelease
      });
    });

    return {
      rows: rows.map((row, index) => ({ ...row, hmi: index + 1, plc: index })),
      repairs: repairs.sort((left, right) => left.index - right.index)
    };
  }

  const api = Object.freeze({ DEFAULT_TOLERANCE, isCodingRelease, reconcile });
  global.LabelerRestCorrectionGrammarDriver = api;
  global.LabelerDriverRegistry?.register("servo.restCorrectionGrammar", api, {
    dependencies: ["servo.command"],
    source: "drivers/servo/rest-correction-grammar-driver.js",
    replace: true
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
