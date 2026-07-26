(function (global) {
  "use strict";

  const PROFILE_ID = "incremental-rotations";
  const EPSILON = 0.001;
  const MAX_EQUIVALENT_ROTATION_DEG = 360;

  function number(value, fallback = null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function text(value, fallback = "") {
    const resolved = String(value ?? "").trim();
    return resolved || fallback;
  }

  function cloneRows(rows) {
    return (Array.isArray(rows) ? rows : []).map((row) => ({ ...row }));
  }

  function aggregateFromAction(action, row = null) {
    const explicit = number(row?.aggregate, number(row?.station));
    if (explicit !== null) return Math.max(1, Math.round(explicit));
    const match = text(action).match(/(?:agg(?:regate)?|station)\s*[-#:]?\s*(\d+)/i);
    return match ? Math.max(1, Number(match[1])) : null;
  }

  function sectionFromAction(action, aggregate = null) {
    const value = text(action).toLowerCase();
    if (/neck/.test(value)) return "neck";
    if (/body/.test(value)) return "body";
    if (/back/.test(value)) return "back";
    if ([1, 2].includes(Number(aggregate))) return "neck";
    if ([3, 4].includes(Number(aggregate))) return "body";
    if ([5, 6].includes(Number(aggregate))) return "back";
    return "general";
  }

  function pairedAggregate(aggregate) {
    const value = Number(aggregate);
    if (!Number.isFinite(value)) return null;
    return value % 2 === 0 ? value - 1 : value + 1;
  }

  function activeSlotNumbers(value, fallbackCount = 6) {
    const source = Array.isArray(value) ? value : [];
    const count = Math.max(1, Math.min(6, Math.round(number(fallbackCount, 6))));
    return Array.from({ length: 6 }, (_, index) => source[index] === undefined ? index < count : Boolean(source[index]))
      .map((enabled, index) => enabled ? index + 1 : null)
      .filter(Boolean);
  }

  function normalizeObjects(options = {}) {
    const sources = [options.objects, options.map?.objects, options.aplObjects, options.coldGlueObjects];
    const objects = [];
    const seen = new Set();
    sources.forEach((source) => {
      if (!Array.isArray(source)) return;
      source.forEach((item, index) => {
        if (!item || typeof item !== "object") return;
        const id = text(item.id, `${item.kind || item.type || "object"}-${item.station || 0}-${index}`);
        if (seen.has(id)) return;
        seen.add(id);
        objects.push({ ...item, id });
      });
    });
    return objects;
  }

  function isInsideWipeObject(item) {
    const kind = text(item?.kind || item?.type).toLowerCase();
    const name = text(item?.name).toLowerCase();
    const side = text(item?.side).toLowerCase();
    const hasInnerChannel = number(item?.innerStart) !== null || number(item?.innerEnd) !== null;
    const wipeKind = /pad|roller|brush|wipe/.test(`${kind} ${name}`);
    return wipeKind && (side === "inner" || /inside|inner/.test(name) || hasInnerChannel);
  }

  function objectRange(item) {
    const start = number(item?.innerStart, number(item?.start, number(item?.angle)));
    if (start === null) return null;
    let end = number(item?.innerEnd, number(item?.end));
    if (end === null) end = start + Math.max(0.1, number(item?.wipeSpanDeg, 10));
    while (end < start) end += 360;
    return { start, end };
  }

  function innerWipeSupport(objects, aggregate) {
    return objects.filter((item) => Number(item?.station ?? item?.aggregate) === Number(aggregate) && isInsideWipeObject(item));
  }

  function machineFamily(options = {}) {
    const machine = text(options.machineType || options.map?.machineType || options.map?.name).toUpperCase();
    if (machine.includes("TOPMODUL")) return "TOPMODUL";
    if (machine.includes("AUTOCOL")) return "AUTOCOL";
    if (machine.includes("MULTIMODUL")) return "MULTIMODUL";
    const grammar = global.LabelerMachineFamilyGrammarDriver;
    return text(grammar?.resolveFamily?.(options), "DEFAULT").toUpperCase();
  }

  function isOrientationAction(action) {
    const value = text(action).toLowerCase();
    if (/wipe\s*turn|brush|roller|pad/.test(value)) return false;
    return /(turn|orient).*(application|coding|coder|sensor|inspection)|(application|coding|coder|sensor|inspection).*(turn|orient)/.test(value);
  }

  function isWipeAction(action) {
    return /wipe|brush|roller|pad/i.test(text(action));
  }

  function segmentDelta(rows, index) {
    const start = number(rows[index]?.plateAngle);
    const end = number(rows[index + 1]?.plateAngle);
    return start !== null && end !== null ? end - start : 0;
  }

  function tableTravel(rows, index) {
    const start = number(rows[index]?.tableAngle);
    const end = number(rows[index + 1]?.tableAngle);
    return start !== null && end !== null ? end - start : 0;
  }

  function lastWipeMovement(rows, beforeIndex, maxLookback = 6) {
    for (let index = beforeIndex; index >= Math.max(0, beforeIndex - maxLookback); index -= 1) {
      const row = rows[index];
      if (Number(row?.cmd) !== 7 || !isWipeAction(row?.action)) continue;
      const delta = segmentDelta(rows, index);
      if (Math.abs(delta) <= EPSILON) continue;
      return {
        index,
        row,
        delta,
        direction: delta > 0 ? 1 : -1,
        aggregate: aggregateFromAction(row.action, row),
        section: sectionFromAction(row.action, aggregateFromAction(row.action, row))
      };
    }
    return null;
  }

  function equivalentDelta(delta, direction) {
    let candidate = number(delta, 0);
    if (direction > 0) {
      while (candidate <= EPSILON) candidate += 360;
    } else {
      while (candidate >= -EPSILON) candidate -= 360;
    }
    return candidate;
  }

  function directionReversals(rows) {
    let previous = 0;
    let reversals = 0;
    for (let index = 0; index < rows.length - 1; index += 1) {
      if (Number(rows[index]?.cmd) !== 7) continue;
      const delta = segmentDelta(rows, index);
      const direction = Math.abs(delta) <= EPSILON ? 0 : delta > 0 ? 1 : -1;
      if (!direction) continue;
      if (previous && direction !== previous) reversals += 1;
      previous = direction;
    }
    return reversals;
  }

  function programMetrics(rows) {
    let totalAbsoluteRotation = 0;
    let netRotation = 0;
    let maximumRatio = 0;
    let motionCount = 0;
    for (let index = 0; index < rows.length - 1; index += 1) {
      if (Number(rows[index]?.cmd) !== 7) continue;
      const delta = segmentDelta(rows, index);
      const travel = tableTravel(rows, index);
      totalAbsoluteRotation += Math.abs(delta);
      netRotation += delta;
      if (Math.abs(delta) > EPSILON) motionCount += 1;
      if (travel > EPSILON) maximumRatio = Math.max(maximumRatio, Math.abs(delta / travel));
    }
    return {
      rowCount: rows.length,
      motionCount,
      totalAbsoluteRotation,
      netRotation,
      directionReversals: directionReversals(rows),
      maximumRatio
    };
  }

  function supportForCandidate(objects, map, departingAggregate) {
    const pair = pairedAggregate(departingAggregate);
    const enabledStations = new Set(activeSlotNumbers(map?.enabledStations, map?.stationCount || 6));
    const required = [departingAggregate];
    if (pair && enabledStations.has(pair)) required.push(pair);
    const byAggregate = Object.fromEntries(required.map((aggregate) => [
      aggregate,
      innerWipeSupport(objects, aggregate)
    ]));
    const missing = required.filter((aggregate) => !byAggregate[aggregate]?.length);
    return {
      pair,
      required,
      byAggregate,
      missing,
      supported: missing.length === 0,
      objectIds: required.flatMap((aggregate) => byAggregate[aggregate].map((item) => String(item.id))),
      objectNames: required.flatMap((aggregate) => byAggregate[aggregate].map((item) => text(item.name || item.id))),
      ranges: required.flatMap((aggregate) => byAggregate[aggregate].map((item) => ({ aggregate, item, range: objectRange(item) })).filter((entry) => entry.range))
    };
  }

  function transform(rows, options = {}) {
    const source = cloneRows(rows);
    const map = options.map || null;
    const family = machineFamily({ ...options, rows: source, map });
    const objects = normalizeObjects({ ...options, map });
    const maxMoveRatio = Math.max(0.1, number(options.maxMoveRatio, 21));
    const allowFallback = options.allowFallback !== false;
    const replacements = new Map();
    const applied = [];
    const fallbacks = [];

    if (family !== "TOPMODUL") {
      return {
        profileId: PROFILE_ID,
        family,
        eligible: false,
        applied: false,
        rows: source,
        appliedMoves: [],
        fallbacks: [{ code: "machine-family", message: "Incremental Rotations currently applies only to TopModul machines." }],
        baselineMetrics: programMetrics(source),
        incrementalMetrics: programMetrics(source)
      };
    }

    for (let index = 0; index < source.length - 1; index += 1) {
      const row = source[index];
      if (Number(row?.cmd) !== 7 || !isOrientationAction(row?.action)) continue;
      if (row?.plateAngleOverride !== null && row?.plateAngleOverride !== undefined && String(row.plateAngleOverride).trim() !== "") {
        fallbacks.push({
          code: "manual-override",
          hmi: row.hmi ?? index + 1,
          message: `HMI ${row.hmi ?? index + 1} retains its manual bottle-angle override.`
        });
        continue;
      }

      const previousWipe = lastWipeMovement(source, index - 1);
      if (!previousWipe) continue;
      const departingAggregate = previousWipe.aggregate;
      if (!departingAggregate) continue;
      const destinationAggregate = aggregateFromAction(row.action, row);
      const support = supportForCandidate(objects, map, departingAggregate);
      const currentDelta = segmentDelta(source, index);
      const proposedDelta = equivalentDelta(currentDelta, previousWipe.direction);
      const addedRotation = Math.abs(proposedDelta - currentDelta);
      const travel = tableTravel(source, index);
      const ratio = travel > EPSILON ? Math.abs(proposedDelta / travel) : Infinity;
      const section = sectionFromAction(row.action, destinationAggregate || departingAggregate);

      if (!support.supported) {
        fallbacks.push({
          code: "inside-wipe-missing",
          hmi: row.hmi ?? index + 1,
          departingAggregate,
          destinationAggregate,
          missingAggregates: support.missing,
          message: `HMI ${row.hmi ?? index + 1} keeps the referenced backspin because inside wipe-down support is missing for Aggregate ${support.missing.join(" and ")}.`
        });
        continue;
      }
      if (Math.abs(proposedDelta) > MAX_EQUIVALENT_ROTATION_DEG + EPSILON || addedRotation > MAX_EQUIVALENT_ROTATION_DEG + EPSILON) {
        fallbacks.push({
          code: "rotation-limit",
          hmi: row.hmi ?? index + 1,
          message: `HMI ${row.hmi ?? index + 1} keeps the referenced path because the equivalent continued turn exceeds ${MAX_EQUIVALENT_ROTATION_DEG}°.`
        });
        continue;
      }
      if (!Number.isFinite(ratio) || ratio >= maxMoveRatio) {
        fallbacks.push({
          code: "speed-limit",
          hmi: row.hmi ?? index + 1,
          currentDelta,
          proposedDelta,
          ratio,
          limit: maxMoveRatio,
          message: `HMI ${row.hmi ?? index + 1} keeps the referenced backspin because the continued turn would require ${Number.isFinite(ratio) ? ratio.toFixed(1) : "unlimited"}:1, above the ${maxMoveRatio.toFixed(1)}:1 limit.`
        });
        continue;
      }
      if (Math.sign(currentDelta) === previousWipe.direction && Math.abs(currentDelta) > EPSILON) {
        continue;
      }

      replacements.set(index, proposedDelta);
      applied.push({
        index,
        hmi: row.hmi ?? index + 1,
        departingAggregate,
        destinationAggregate,
        section,
        preferredDirection: previousWipe.direction > 0 ? "positive" : "negative",
        baselineDelta: currentDelta,
        incrementalDelta: proposedDelta,
        tableTravel: travel,
        speedRatio: ratio,
        insideWipeObjectIds: support.objectIds,
        insideWipeObjectNames: support.objectNames,
        message: `HMI ${row.hmi ?? index + 1} continues ${previousWipe.direction > 0 ? "forward" : "reverse"} rotation by ${Math.abs(proposedDelta).toFixed(1)}° instead of reversing ${Math.abs(currentDelta).toFixed(1)}°.`
      });
    }

    if (!applied.length) {
      return {
        profileId: PROFILE_ID,
        family,
        eligible: true,
        applied: false,
        rows: source,
        appliedMoves: [],
        fallbacks,
        baselineMetrics: programMetrics(source),
        incrementalMetrics: programMetrics(source)
      };
    }

    const baselineAngles = source.map((row) => number(row?.plateAngle, 0));
    const rebuiltAngles = [baselineAngles[0]];
    for (let index = 0; index < source.length - 1; index += 1) {
      const originalDelta = baselineAngles[index + 1] - baselineAngles[index];
      const delta = replacements.has(index) ? replacements.get(index) : originalDelta;
      rebuiltAngles[index + 1] = rebuiltAngles[index] + delta;
    }

    const transformed = source.map((row, index) => {
      const updated = {
        ...row,
        plateAngle: rebuiltAngles[index],
        generatedPlateAngle: rebuiltAngles[index],
        appliedMotionProfileId: PROFILE_ID,
        resolvedMotionProfileId: PROFILE_ID
      };
      const move = applied.find((entry) => entry.index === index);
      if (move) {
        updated.incrementalRotation = true;
        updated.incrementalRotationSourceAggregate = move.departingAggregate;
        updated.incrementalRotationTargetAggregate = move.destinationAggregate;
        updated.incrementalRotationDirection = move.preferredDirection;
        updated.incrementalRotationBaselineTravel = move.baselineDelta;
        updated.incrementalRotationTravel = move.incrementalDelta;
        updated.incrementalRotationInsideObjectIds = move.insideWipeObjectIds;
        updated.incrementalRotationInsideObjectNames = move.insideWipeObjectNames;
        updated.plannerIntent = "ROTATE";
        updated.plannerReason = move.message;
        updated.action = /^incremental\b/i.test(text(updated.action))
          ? updated.action
          : `Incremental ${text(updated.action, "Turn to Next Process")}`;
      }
      if (index > 0 && applied.some((entry) => entry.index === index - 1)) {
        updated.incrementalRotationTarget = true;
      }
      return updated;
    });

    const baselineMetrics = programMetrics(source);
    const incrementalMetrics = programMetrics(transformed);
    return {
      profileId: PROFILE_ID,
      family,
      eligible: true,
      applied: true,
      rows: transformed,
      appliedMoves: applied,
      fallbacks: allowFallback ? fallbacks : [],
      baselineMetrics,
      incrementalMetrics,
      comparison: {
        totalAbsoluteRotationChange: incrementalMetrics.totalAbsoluteRotation - baselineMetrics.totalAbsoluteRotation,
        directionReversalChange: incrementalMetrics.directionReversals - baselineMetrics.directionReversals,
        maximumRatioChange: incrementalMetrics.maximumRatio - baselineMetrics.maximumRatio
      }
    };
  }

  global.LabelerIncrementalRotationDriver = Object.freeze({
    PROFILE_ID,
    EPSILON,
    MAX_EQUIVALENT_ROTATION_DEG,
    aggregateFromAction,
    sectionFromAction,
    pairedAggregate,
    activeSlotNumbers,
    normalizeObjects,
    isInsideWipeObject,
    innerWipeSupport,
    objectRange,
    machineFamily,
    isOrientationAction,
    isWipeAction,
    segmentDelta,
    tableTravel,
    lastWipeMovement,
    equivalentDelta,
    directionReversals,
    programMetrics,
    supportForCandidate,
    transform
  });
})(window);
