"use strict";

(function installColdGlueNeckLeftRightWipe() {
  const RETRY_MS = 50;
  const EPSILON = 0.001;
  const FULL_CYCLE = 360;
  const MIN_ROW_GAP = 0.1;
  const GRIPPER_CENTERLINE_ANGLE = 0;
  const NECK_OVERWIPE_MM = 5;
  const MAX_SAFE_CONTACT_TURN = 359;
  const LEFT_BRUSH_SIDE = "outer";
  const RIGHT_BRUSH_SIDE = "inner";
  let installed = false;

  function finite(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function finish(value) {
    return typeof finishAngle === "function"
      ? finishAngle(value)
      : Math.round(finite(value, 0) * 10) / 10;
  }

  function currentMap() {
    try {
      return typeof activeMachineMap === "function" ? activeMachineMap() : null;
    } catch {
      return null;
    }
  }

  function nearestEquivalent(target, reference) {
    const base = finite(target, 0);
    const current = finite(reference, base);
    return base + FULL_CYCLE * Math.round((current - base) / FULL_CYCLE);
  }

  function atOrAfter(angle, minimum) {
    let value = finite(angle, minimum);
    while (value < minimum - EPSILON) value += FULL_CYCLE;
    return value;
  }

  function activeObjects(map) {
    const runtime = Array.isArray(state?.coldGlueMap) ? state.coldGlueMap : [];
    const saved = Array.isArray(map?.objects) ? map.objects : [];
    const runtimeHasGeometry = runtime.some((item) =>
      ["brush", "brush-channel", "gripper", "pallet"].includes(String(item?.kind || ""))
    );
    return runtimeHasGeometry ? runtime : saved;
  }

  function gripperForStation(map, station) {
    return activeObjects(map).find((item) =>
      ["gripper", "pallet"].includes(String(item?.kind || ""))
      && Number(item?.station) === Number(station)
    ) || null;
  }

  function brushObjectsForStation(map, station) {
    return activeObjects(map).filter((item) =>
      Number(item?.station) === Number(station)
      && (item?.kind === "brush" || item?.kind === "brush-channel")
    );
  }

  function expandBrushes(objects, minimumTable) {
    return objects.flatMap((item, index) => {
      const normalizeRange = (side, startValue, endValue, suffix) => {
        const start = atOrAfter(startValue, minimumTable);
        let end = atOrAfter(endValue, start + EPSILON);
        while (end <= start + EPSILON) end += FULL_CYCLE;
        return {
          id: `${item?.id || `brush-${index}`}-${suffix}`,
          side,
          start,
          end
        };
      };

      if (item?.kind === "brush-channel") {
        return [
          normalizeRange("outer", finite(item.outerStart, item.start), finite(item.outerEnd, item.end), "outer"),
          normalizeRange("inner", finite(item.innerStart, item.start), finite(item.innerEnd, item.end), "inner")
        ];
      }

      return [normalizeRange(
        item?.side === "inner" ? "inner" : "outer",
        finite(item?.start, 0),
        finite(item?.end, finite(item?.start, 0) + 1),
        item?.side === "inner" ? "inner" : "outer"
      )];
    }).sort((a, b) => a.start - b.start || a.end - b.end);
  }

  function mergeRanges(ranges) {
    const sorted = ranges
      .filter((range) => range.end > range.start + EPSILON)
      .sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [];
    sorted.forEach((range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end + EPSILON) {
        previous.end = Math.max(previous.end, range.end);
        previous.ids.push(range.id);
      } else {
        merged.push({ start: range.start, end: range.end, side: range.side, ids: [range.id] });
      }
    });
    return merged;
  }

  function intersections(leftRanges, rightRanges) {
    const result = [];
    leftRanges.forEach((left) => {
      rightRanges.forEach((right) => {
        const start = Math.max(left.start, right.start);
        const end = Math.min(left.end, right.end);
        if (end > start + EPSILON) result.push({ start, end });
      });
    });
    return mergeRanges(result.map((range, index) => ({ ...range, side: "opposed", id: `opposed-${index}` })));
  }

  function appendIssue(issue) {
    if (!state?.motionPlan?.mapDriven) return;
    state.motionPlan.issues = Array.isArray(state.motionPlan.issues) ? state.motionPlan.issues : [];
    const key = `${issue.code}:${issue.station || ""}:${issue.side || ""}`;
    if (state.motionPlan.issues.some((entry) => `${entry.code}:${entry.station || ""}:${entry.side || ""}` === key)) return;
    state.motionPlan.issues.push(issue);
  }

  function pushRow(rows, cmd, tableAngle, plateAngle, action, extra = {}) {
    rows.push({
      hmi: 0,
      plc: 0,
      cmd,
      tableAngle: finish(tableAngle),
      plateAngle: finish(plateAngle),
      action,
      fixedColdGlueMap: false,
      motionSource: "cold-glue-neck-left-right",
      coldGlueNeckTwoSideWipe: true,
      ...extra
    });
  }

  function selectedNeckGeometry() {
    const wipe = typeof sectionWipePlan === "function" ? sectionWipePlan("neck") : null;
    const label = typeof selectedLabelSpec === "function" ? selectedLabelSpec() : null;
    const circumferenceMm = finite(label?.neckBottomCircumferenceMm, NaN);
    const labelDeg = Math.max(0, finite(wipe?.labelDeg, 0));
    const geometry = window.LabelerGeometryDriver;
    const overWipeDeg = Number.isFinite(circumferenceMm) && circumferenceMm > 0 && geometry?.degreesFromMm
      ? Math.max(0, finite(geometry.degreesFromMm(NECK_OVERWIPE_MM, circumferenceMm), 0))
      : 0;
    const stageRequired = labelDeg / 2 + overWipeDeg;
    return { labelDeg, circumferenceMm, overWipeMm: NECK_OVERWIPE_MM, overWipeDeg, stageRequired };
  }

  function tableAngleForGripper(map, station, minimumTable, originalBlock) {
    const gripper = gripperForStation(map, station);
    if (gripper) {
      return {
        tableAngle: atOrAfter(finite(gripper.angle, gripper.start), minimumTable),
        source: "map-gripper",
        gripper
      };
    }

    const settings = state?.coldGlueAggregateSettings || {};
    const fallback = finite(
      settings?.aggregateAngles?.[String(station)],
      finite(
        map?.aggregateAngles?.[String(station)],
        finite(map?.stationAngles?.[String(station)], finite(originalBlock.find((row) => Number(row.cmd) === 3)?.tableAngle, minimumTable))
      )
    );
    return { tableAngle: atOrAfter(fallback, minimumTable), source: "aggregate-fallback", gripper: null };
  }

  function allocateMotion({
    rows,
    windows,
    currentTable,
    currentPlate,
    signedRotation,
    safeRatio,
    station,
    side,
    stageName,
    action,
    completionAction,
    geometry
  }) {
    let remaining = Math.abs(signedRotation);
    const direction = Math.sign(signedRotation) || 1;
    let table = currentTable;
    let plate = currentPlate;

    for (const window of windows) {
      if (remaining <= EPSILON) break;
      const start = Math.max(window.start, table + MIN_ROW_GAP);
      if (start >= window.end - EPSILON) continue;
      const availableSpan = window.end - start;
      const rotation = Math.min(remaining, availableSpan * safeRatio, MAX_SAFE_CONTACT_TURN);
      if (rotation <= EPSILON) continue;
      const requiredSpan = rotation / safeRatio;
      const end = Math.min(window.end, start + requiredSpan);
      const actualSpan = Math.max(EPSILON, end - start);
      const actualRotation = Math.min(rotation, actualSpan * safeRatio);

      pushRow(rows, 7, start, plate, action, {
        station,
        section: "neck",
        brushStage: stageName,
        brushSide: side,
        neckWipeSide: stageName,
        wipeOutward: true,
        overWipeMm: geometry.overWipeMm,
        overWipeDeg: geometry.overWipeDeg,
        plannedRotation: direction * actualRotation,
        plannedRatio: actualRotation / actualSpan,
        objectIds: window.ids || []
      });
      plate += direction * actualRotation;
      pushRow(rows, 3, end, plate, completionAction, {
        station,
        section: "neck",
        brushStage: `${stageName}-complete`,
        brushSide: side,
        neckWipeSide: stageName,
        wipeOutward: true,
        overWipeMm: geometry.overWipeMm,
        overWipeDeg: geometry.overWipeDeg,
        plannedRotation: direction * actualRotation,
        plannedRatio: actualRotation / actualSpan,
        objectIds: window.ids || []
      });

      remaining -= actualRotation;
      table = end;
    }

    return { remaining: Math.max(0, remaining), table, plate };
  }

  function buildNeckTwoSideBlock(map, station, previousRow, originalBlock) {
    const brushes = brushObjectsForStation(map, station);
    if (!brushes.length) return originalBlock;

    const geometry = selectedNeckGeometry();
    if (geometry.labelDeg <= EPSILON) return originalBlock;

    const hardLimit = Math.max(0.1, finite(state?.maxMoveRatio, 21));
    const safeRatio = Math.max(0.1, hardLimit * 0.9);
    const output = [];
    let lastTable = finite(previousRow?.tableAngle, 0);
    let plate = finite(previousRow?.plateAngle, finite(state?.buildInputs?.plateStartPositionDeg, 0));

    const gripperReference = tableAngleForGripper(map, station, lastTable + MIN_ROW_GAP, originalBlock);
    const gripperTable = gripperReference.tableAngle;
    const centerPlate = nearestEquivalent(GRIPPER_CENTERLINE_ANGLE, plate);
    const centerRotation = centerPlate - plate;

    if (!gripperReference.gripper) {
      appendIssue({
        level: "warn",
        code: "cold-glue-neck-gripper-fallback",
        station,
        section: "neck",
        message: `Aggregate ${station} has no Gripper / Spender Plate object. The aggregate location was used as the neck-label centerline reference.`
      });
    }

    if (Math.abs(centerRotation) > EPSILON) {
      const availableSpan = Math.max(EPSILON, gripperTable - lastTable);
      const requiredSpan = Math.abs(centerRotation) / safeRatio;
      const turnStart = Math.max(lastTable, gripperTable - requiredSpan);
      const actualSpan = Math.max(EPSILON, gripperTable - turnStart);
      pushRow(output, 7, turnStart, plate, `Align Neck Label Centerline at Gripper - Agg ${station}`, {
        station,
        section: "neck",
        brushStage: "gripper-centerline",
        gripperCenterline: true,
        plannedRotation: centerRotation,
        plannedRatio: Math.abs(centerRotation) / actualSpan
      });
      plate = centerPlate;
      if (requiredSpan > availableSpan + EPSILON) {
        appendIssue({
          level: "bad",
          code: "cold-glue-neck-gripper-window",
          station,
          section: "neck",
          message: `Aggregate ${station} does not provide enough table travel to reach the gripper centerline before neck-label application.`
        });
      }
    }

    pushRow(output, 3, gripperTable, centerPlate, `Hold Neck Label Centerline at Gripper - Agg ${station}`, {
      station,
      section: "neck",
      brushStage: "gripper-application",
      gripperCenterline: true
    });
    lastTable = gripperTable;
    plate = centerPlate;

    const expanded = expandBrushes(brushes, gripperTable + EPSILON);
    const outerRanges = mergeRanges(expanded.filter((range) => range.side === LEFT_BRUSH_SIDE));
    const innerRanges = mergeRanges(expanded.filter((range) => range.side === RIGHT_BRUSH_SIDE));
    const opposedRanges = intersections(outerRanges, innerRanges);
    const opposed = opposedRanges.find((range) => range.end > gripperTable + EPSILON);

    if (!opposed) {
      appendIssue({
        level: "bad",
        code: "cold-glue-neck-opposed-press-missing",
        station,
        section: "neck",
        message: `Aggregate ${station} has no overlapping inside/outside brush section to press both loose neck-label sides down before wiping.`
      });
      return output;
    }

    const brushEntry = Math.max(opposed.start, lastTable + MIN_ROW_GAP);
    const opposedSpan = Math.max(0, opposed.end - brushEntry);
    const pressSpan = Math.min(opposedSpan, Math.max(0.5, Math.min(2, opposedSpan * 0.2)));
    const pressEnd = brushEntry + pressSpan;

    pushRow(output, 3, brushEntry, plate, `Press Both Loose Neck Label Sides Down - Agg ${station}`, {
      station,
      section: "neck",
      brushStage: "press-both-sides",
      channelHold: true,
      holdAngle: GRIPPER_CENTERLINE_ANGLE,
      objectIds: opposed.ids || []
    });
    lastTable = pressEnd;

    if (geometry.stageRequired >= FULL_CYCLE - EPSILON || geometry.stageRequired * 2 >= FULL_CYCLE - EPSILON) {
      appendIssue({
        level: "bad",
        code: "cold-glue-neck-full-turn-blocked",
        station,
        section: "neck",
        message: `Aggregate ${station} neck wipe geometry would require a complete bottle revolution under brush contact. The move was limited to preserve the label.`
      });
    }

    const leftRequired = Math.min(MAX_SAFE_CONTACT_TURN, geometry.stageRequired);
    const leftWindows = outerRanges.filter((range) => range.end > lastTable + MIN_ROW_GAP);
    const left = allocateMotion({
      rows: output,
      windows: leftWindows,
      currentTable: lastTable,
      currentPlate: plate,
      signedRotation: -leftRequired,
      safeRatio,
      station,
      side: LEFT_BRUSH_SIDE,
      stageName: "left",
      action: `Wipe Neck Label Left Side Outward + ${NECK_OVERWIPE_MM} mm - Agg ${station}`,
      completionAction: `Hold at Left Neck Label Over-Wipe Edge - Agg ${station}`,
      geometry
    });
    lastTable = left.table;
    plate = left.plate;

    if (left.remaining > EPSILON) {
      appendIssue({
        level: "bad",
        code: "cold-glue-neck-left-capacity",
        station,
        section: "neck",
        side: LEFT_BRUSH_SIDE,
        message: `Aggregate ${station} left/outside brush contact is short by ${left.remaining.toFixed(1)}° of bottle rotation for the left half of the neck label plus ${NECK_OVERWIPE_MM} mm over-wipe.`
      });
    }

    const rightRequired = Math.min(MAX_SAFE_CONTACT_TURN, geometry.stageRequired * 2);
    const rightWindows = innerRanges.filter((range) => range.end > lastTable + MIN_ROW_GAP);
    const right = allocateMotion({
      rows: output,
      windows: rightWindows,
      currentTable: lastTable,
      currentPlate: plate,
      signedRotation: rightRequired,
      safeRatio,
      station,
      side: RIGHT_BRUSH_SIDE,
      stageName: "right",
      action: `Wipe Neck Label Right Side Outward + ${NECK_OVERWIPE_MM} mm - Agg ${station}`,
      completionAction: `Hold at Right Neck Label Over-Wipe Edge - Agg ${station}`,
      geometry
    });

    if (right.remaining > EPSILON) {
      appendIssue({
        level: "bad",
        code: "cold-glue-neck-right-capacity",
        station,
        section: "neck",
        side: RIGHT_BRUSH_SIDE,
        message: `Aggregate ${station} right/inside brush contact is short by ${right.remaining.toFixed(1)}° of bottle rotation. Extend the right brush; the tool will not rotate through a no-contact gap.`
      });
    }

    return output;
  }

  function collapseArtificialCycles(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return rows;
    let previous = finite(rows[0]?.tableAngle, 0);
    return rows.map((row, index) => {
      if (index === 0) return { ...row };
      const raw = finite(row?.tableAngle, previous);
      let tableAngle = raw;
      while (tableAngle - previous >= FULL_CYCLE - EPSILON) tableAngle -= FULL_CYCLE;
      if (tableAngle < previous - EPSILON) {
        previous = raw;
        return { ...row };
      }
      previous = tableAngle;
      return Math.abs(tableAngle - raw) > EPSILON
        ? { ...row, tableAngle: finish(tableAngle), tableCycleCorrected: true }
        : { ...row };
    });
  }

  function applyNeckTwoSideMotion(rows, map) {
    if (!Array.isArray(rows) || !map || map.applicationMode !== "cold-glue") return rows;
    let result = rows.map((row) => ({ ...row }));
    const stations = [...new Set(
      result
        .filter((row) => row?.section === "neck" && Number.isFinite(Number(row?.station)))
        .map((row) => Number(row.station))
    )].sort((a, b) => a - b);

    if (state?.motionPlan?.mapDriven) {
      const stationSet = new Set(stations);
      const neckCodes = new Set([
        "cold-glue-gripper-centerline-fallback",
        "cold-glue-gripper-alignment-window",
        "cold-glue-opposed-channel-missing",
        "cold-glue-channel-entry-window",
        "cold-glue-full-turn-blocked",
        "cold-glue-center-out-runout-missing",
        "cold-glue-opposite-edge-contact-blocked",
        "cold-glue-label-length-runout-capacity",
        "cold-glue-center-out-capacity",
        "cold-glue-neck-gripper-fallback",
        "cold-glue-neck-gripper-window",
        "cold-glue-neck-opposed-press-missing",
        "cold-glue-neck-full-turn-blocked",
        "cold-glue-neck-left-capacity",
        "cold-glue-neck-right-capacity"
      ]);
      state.motionPlan.issues = (Array.isArray(state.motionPlan.issues) ? state.motionPlan.issues : []).filter((issue) =>
        !(issue?.section === "neck" && stationSet.has(Number(issue?.station)) && neckCodes.has(String(issue?.code || "")))
      );
    }

    stations.forEach((station) => {
      const indexes = result
        .map((row, index) => Number(row?.station) === station && row?.section === "neck" ? index : -1)
        .filter((index) => index >= 0);
      if (!indexes.length || !brushObjectsForStation(map, station).length) return;
      const first = indexes[0];
      const last = indexes[indexes.length - 1];
      const previous = result[first - 1] || null;
      const originalBlock = result.slice(first, last + 1);
      const replacement = buildNeckTwoSideBlock(map, station, previous, originalBlock);
      result.splice(first, last - first + 1, ...replacement);
    });

    result = collapseArtificialCycles(result).map((row, index) => ({ ...row, hmi: index + 1, plc: index }));
    if (state?.motionPlan?.mapDriven) state.motionPlan.rows = result;
    return result;
  }

  function wrapGenerator() {
    const original = window.generatedColdGlueFixedProfile;
    if (typeof original !== "function" || original.coldGlueNeckLeftRightWrapped) return false;
    const wrapped = function generatedColdGlueNeckLeftRightProfile(...args) {
      return applyNeckTwoSideMotion(original.apply(this, args), currentMap());
    };
    wrapped.coldGlueNeckLeftRightWrapped = true;
    wrapped.originalGenerator = original;
    window.generatedColdGlueFixedProfile = wrapped;
    try { generatedColdGlueFixedProfile = wrapped; } catch { /* global binding may be read-only */ }
    return true;
  }

  function install() {
    if (installed) return true;
    if (typeof state === "undefined" || typeof window.generatedColdGlueFixedProfile !== "function") return false;
    if (!wrapGenerator()) return false;
    installed = true;
    return true;
  }

  function wait() {
    if (install()) return;
    window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();
