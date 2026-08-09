"use strict";

(function installAplFinishedCenterlineCompletion(global) {
  if (global.LabelerAplFinishedCenterlineCompletion?.installed) return;

  const VERSION = 1;
  const BUILD = "finished-centerline-completion-v39";
  const EPS = 0.001;
  const RETRY_MS = 50;

  const finite = (value, fallback = NaN) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const text = (value) => String(value ?? "").trim();
  const stateRef = () => typeof state !== "undefined" ? state : global.state;
  const round = (value) => typeof global.finishAngle === "function"
    ? global.finishAngle(value)
    : Math.round(finite(value, 0) * 10) / 10;

  function nearestEquivalent(target, reference) {
    const base = finite(target, 0);
    const current = finite(reference, base);
    return base + 360 * Math.round((current - base) / 360);
  }

  function circularDistance(left, right) {
    return Math.abs(((finite(left, 0) - finite(right, 0) + 540) % 360) - 180);
  }

  function applications() {
    try {
      return typeof global.selectedLabelApplicationState === "function"
        ? global.selectedLabelApplicationState()
        : { neck: true, body: true, back: true };
    } catch {
      return { neck: true, body: true, back: true };
    }
  }

  function policy() {
    return global.LabelerLabelCenterlinePolicy || null;
  }

  function applicationReference(section) {
    const api = policy();
    if (api?.applicationReference) return api.applicationReference(section, null, stateRef());
    const inputs = stateRef()?.buildInputs || {};
    const raw = text(inputs[`${section}ApplicationReference`] || (section === "neck" ? inputs.neckApplication : "Leading Edge")).toLowerCase();
    return raw.includes("center") ? "center-tack" : "leading-edge";
  }

  function sectionOffsetDeg(section) {
    const api = policy();
    if (api?.sectionOffsetDeg) return finite(api.sectionOffsetDeg(section, stateRef()), 0);
    if (section === "neck") return 0;
    const target = stateRef();
    const mm = finite(target?.buildInputs?.[`${section}OffsetMm`], 0);
    if (!mm) return 0;
    try {
      const circumference = typeof global.bodyCircumference === "function"
        ? global.bodyCircumference(global.selectedBottleSpec?.())
        : NaN;
      return Number.isFinite(circumference) && circumference > 0 ? mm / circumference * 360 : 0;
    } catch {
      return 0;
    }
  }

  function frontCenterline() {
    return finite(stateRef()?.buildInputs?.centerLineFrontDeg, 0);
  }

  function finishedCenterline(section) {
    const front = frontCenterline();
    if (section === "back") return front + 180 + sectionOffsetDeg("back");
    if (section === "body") return front + sectionOffsetDeg("body");
    return front;
  }

  function applicationTarget(section) {
    const center = finishedCenterline(section);
    const api = policy();
    if (api?.applicationTargetFromCenterline) {
      return finite(api.applicationTargetFromCenterline(section, center, applicationReference(section), stateRef()), center);
    }
    if (applicationReference(section) !== "leading-edge") return center;
    const width = finite(api?.labelWidthDeg?.(section, stateRef()), NaN);
    return Number.isFinite(width) ? center - width / 2 : center;
  }

  function solveAplWipe(section) {
    const target = stateRef();
    if (String(target?.applicationMode || "").toLowerCase() !== "apl") return null;
    const label = global.selectedLabelSpec?.();
    const bottle = global.selectedBottleSpec?.();
    if (!label) return null;
    const circumferenceMm = section === "neck"
      ? finite(label.neckBottomCircumferenceMm, NaN)
      : global.bodyCircumference?.(bottle);
    const neckCurveMm = finite(label.neckBottomCurveMm, 0);
    const neckLengthMm = finite(label.neckLengthMm, 0);
    const labelLengthMm = section === "neck"
      ? (neckCurveMm > 0 ? neckCurveMm : neckLengthMm)
      : section === "body"
        ? label.bodyLengthMm
        : label.backLengthMm;
    const contactMm = section === "neck"
      ? target.buildInputs?.neckContactMm
      : section === "body"
        ? target.buildInputs?.bodyContactMm
        : target.buildInputs?.backContactMm;
    const overWipeDeg = section === "neck"
      ? target.buildInputs?.neckOverWipeDeg
      : section === "body"
        ? target.buildInputs?.bodyOverWipeDeg
        : target.buildInputs?.backOverWipeDeg;
    const mode = applicationReference(section) === "center-tack"
      ? "center-tack-two-stage"
      : "leading-edge";
    return global.LabelerGeometryDriver?.solveSection?.({
      mode,
      labelLengthMm,
      circumferenceMm,
      contactMm,
      overWipeDeg
    }) || null;
  }

  function wrapSectionWipePlan() {
    const current = global.sectionWipePlan;
    if (typeof current !== "function") return false;
    if (current.finishedCenterlineCompletionV39) return true;
    const base = current;
    const wrapped = function sectionWipePlanWithPerSectionApplicationReference(section) {
      const normalized = text(section).toLowerCase();
      if (!["neck", "body", "back"].includes(normalized)
        || String(stateRef()?.applicationMode || "").toLowerCase() !== "apl") {
        return base.apply(this, arguments);
      }
      return solveAplWipe(normalized) || base.apply(this, arguments);
    };
    wrapped.finishedCenterlineCompletionV39 = true;
    wrapped.previousSectionWipePlan = base;
    global.sectionWipePlan = wrapped;
    return true;
  }

  function stationSections(machineMap) {
    try {
      return typeof global.inferAplStationSections === "function"
        ? global.inferAplStationSections(machineMap)
        : { ...(machineMap?.stationSections || {}) };
    } catch {
      return { ...(machineMap?.stationSections || {}) };
    }
  }

  function sectionForStation(station, sections) {
    const explicit = text(sections?.[String(station)]).toLowerCase();
    if (["neck", "body", "back", "none"].includes(explicit)) return explicit;
    try {
      const fallback = text(global.labelSectionForStation?.(station)).toLowerCase();
      if (["neck", "body", "back", "none"].includes(fallback)) return fallback;
    } catch {}
    return Number(station) <= 2 ? "neck" : Number(station) <= 4 ? "body" : "back";
  }

  function stationSequence(machineMap) {
    const active = applications();
    const sections = stationSections(machineMap);
    const grouped = new Map();
    (Array.isArray(machineMap?.objects) ? machineMap.objects : [])
      .filter((item) => item?.enabled !== false && (item?.kind === "pad" || item?.kind === "roller"))
      .forEach((item) => {
        const station = Number(item.station ?? item.aggregate);
        if (!Number.isFinite(station)) return;
        if (!grouped.has(station)) grouped.set(station, []);
        grouped.get(station).push(item);
      });
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([station, objects]) => ({ station, objects, section: sectionForStation(station, sections) }))
      .filter((entry) => ["neck", "body", "back"].includes(entry.section) && active?.[entry.section] !== false);
  }

  function aggregateAngle(machineMap, station) {
    return finite(
      machineMap?.aggregateAngles?.[String(station)],
      finite(machineMap?.stationAngles?.[String(station)], NaN)
    );
  }

  function applicationPoint(machineMap, station) {
    const aggregate = aggregateAngle(machineMap, station);
    const early = finite(global.profileTiming?.spenderArriveEarly, 7.5);
    return Number.isFinite(aggregate) ? aggregate - early : NaN;
  }

  function rowStation(row) {
    const explicit = Number(row?.station ?? row?.aggregate);
    if (Number.isFinite(explicit)) return explicit;
    const match = text(row?.action).match(/Agg\s*(\d+)/i);
    return match ? Number(match[1]) : NaN;
  }

  function rowSection(row) {
    const explicit = text(row?.section).toLowerCase();
    if (["neck", "body", "back"].includes(explicit)) return explicit;
    const match = text(row?.action).match(/\b(Neck|Body|Back)\b/i);
    return match ? match[1].toLowerCase() : "";
  }

  function isApplicationRow(row, station, section) {
    return rowStation(row) === Number(station)
      && rowSection(row) === section
      && /Application/i.test(text(row?.action));
  }

  function findWipeGroup(rows, station, section) {
    const matching = (row, turn) => rowStation(row) === Number(station)
      && rowSection(row) === section
      && new RegExp(`Wipe\\s+Turn\\s+${turn}`, "i").test(text(row?.action));
    const w1 = rows.findIndex((row) => matching(row, 1));
    if (w1 < 0) return null;
    const w2 = rows.findIndex((row, index) => index > w1 && matching(row, 2));
    if (w2 < 0) return null;
    let hold = -1;
    for (let index = w2 + 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (rowStation(row) === Number(station) && rowSection(row) === section && Number(row?.cmd) === 3) {
        hold = index;
        break;
      }
      if (rowStation(row) !== Number(station) && /Application/i.test(text(row?.action))) break;
    }
    return hold >= 0 ? { w1, w2, hold } : null;
  }

  function contactOrientation(objects) {
    const preferredKind = objects.some((item) => item.kind === "pad") ? "pad" : "roller";
    const preferred = objects.filter((item) => item.kind === preferredKind);
    if (!preferred.length) return 1;
    return preferred.every((item) => text(item.side).toLowerCase() === "inner") ? -1 : 1;
  }

  function fullWipeRotations(section, objects, wipe, rows, group) {
    const orientation = contactOrientation(objects);
    if (wipe?.mode === "leading-edge") {
      const first = -Math.abs(finite(wipe.backSpinRequired, finite(wipe.stages?.[0]?.requiredRotation, 0))) * orientation;
      const second = Math.abs(finite(wipe.forwardWipeRequired, finite(wipe.stages?.[1]?.requiredRotation, 0))) * orientation;
      return [first, second];
    }
    const existingFirst = finite(rows[group.w1]?.plannedRotation, NaN);
    const existingSecond = finite(rows[group.w2]?.plannedRotation, NaN);
    if (Number.isFinite(existingFirst) && Number.isFinite(existingSecond)) return [existingFirst, existingSecond];
    const firstRequired = Math.abs(finite(wipe?.stages?.[0]?.requiredRotation, finite(wipe?.stageRequired, 0)));
    const secondRequired = Math.abs(finite(wipe?.stages?.[1]?.requiredRotation, finite(wipe?.stageRequired, firstRequired)));
    return [firstRequired * orientation, -secondRequired * orientation];
  }

  function makeRow(cmd, tableAngle, plateAngle, action, extra = {}) {
    return {
      hmi: 0,
      plc: 0,
      cmd,
      tableAngle: round(tableAngle),
      plateAngle: round(plateAngle),
      action,
      motionSource: "apl-finished-centerline-completion-v39",
      mapDriven: true,
      finishedCenterlineCompletionV39: true,
      ...extra
    };
  }

  function insertSorted(rows, row) {
    const table = finite(row?.tableAngle, Infinity);
    let index = rows.findIndex((candidate) => finite(candidate?.tableAngle, Infinity) > table + EPS);
    if (index < 0) index = rows.length;
    rows.splice(index, 0, row);
    return row;
  }

  function precedingRow(rows, tableAngle) {
    let result = null;
    rows.forEach((row) => {
      const table = finite(row?.tableAngle, NaN);
      if (!Number.isFinite(table) || table >= tableAngle - EPS) return;
      if (!result || table > finite(result.tableAngle, -Infinity)) result = row;
    });
    return result;
  }

  function ensureApplicationReference(rows, descriptor) {
    const { station, section, machineMap } = descriptor;
    const targetTable = applicationPoint(machineMap, station);
    const targetPlateRaw = applicationTarget(section);
    if (!Number.isFinite(targetTable) || !Number.isFinite(targetPlateRaw)) return null;
    const wipe = findWipeGroup(rows, station, section);
    const wipeStartTable = wipe ? finite(rows[wipe.w1]?.tableAngle, targetTable + 1) : Infinity;
    let anchor = rows.find((row) => isApplicationRow(row, station, section)
      && Number(row?.cmd) === 3
      && finite(row?.tableAngle, Infinity) <= wipeStartTable + EPS);
    if (!anchor) {
      anchor = makeRow(3, targetTable, targetPlateRaw, `Hold for ${global.sectionLabel?.(section) || section} Application - Agg ${station} - Reference`, {
        station,
        section,
        applicationReference: true,
        applicationReferenceMode: applicationReference(section),
        finishedLabelCenterlineDeg: round(finishedCenterline(section))
      });
      insertSorted(rows, anchor);
    }
    const targetPlate = nearestEquivalent(targetPlateRaw, finite(anchor.plateAngle, targetPlateRaw));
    anchor.tableAngle = round(targetTable);
    anchor.plateAngle = round(targetPlate);
    anchor.applicationReference = true;
    anchor.applicationReferenceMode = applicationReference(section);
    anchor.finishedLabelCenterlineDeg = round(finishedCenterline(section));
    anchor.finishedCenterlineCompletionV39 = true;
    const before = precedingRow(rows, targetTable);
    if (!before) return anchor;
    const beforePlate = finite(before.plateAngle, targetPlate);
    if (circularDistance(beforePlate, targetPlate) <= EPS) return anchor;
    const existingTurn = rows.find((row) => Number(row?.cmd) === 7
      && isApplicationRow(row, station, section)
      && finite(row?.tableAngle, -Infinity) > finite(before.tableAngle, -Infinity) - EPS
      && finite(row?.tableAngle, Infinity) < targetTable - EPS);
    const startTable = Math.max(finite(before.tableAngle, 0) + 0.5, targetTable - Math.max(0.5, (targetTable - finite(before.tableAngle, 0)) * 0.8));
    const turn = existingTurn || insertSorted(rows, makeRow(7, startTable, beforePlate, `Turn for ${global.sectionLabel?.(section) || section} Application - Agg ${station}`, {
      station,
      section,
      applicationTransition: true
    }));
    turn.cmd = 7;
    turn.plateAngle = round(beforePlate);
    turn.station = station;
    turn.section = section;
    turn.applicationTransition = true;
    turn.finishedCenterlineCompletionV39 = true;
    return anchor;
  }

  function addRecoveryIssue(message, station, section) {
    const target = stateRef();
    if (!target?.motionPlan || typeof target.motionPlan !== "object") return;
    target.motionPlan.issues = Array.isArray(target.motionPlan.issues) ? target.motionPlan.issues : [];
    if (target.motionPlan.issues.some((issue) => issue?.code === "apl-finished-centerline-recovery-window" && Number(issue.station) === Number(station))) return;
    target.motionPlan.issues.push({ level: "bad", code: "apl-finished-centerline-recovery-window", station, section, message });
  }

  function ensureFinishedCenterlineRecovery(rows, descriptor, group) {
    const { station, section, machineMap } = descriptor;
    const hold = rows[group.hold];
    if (!hold) return;
    const current = finite(hold.plateAngle, NaN);
    if (!Number.isFinite(current)) return;
    const center = nearestEquivalent(finishedCenterline(section), current);
    hold.action = `Wipe Hold ${global.sectionLabel?.(section) || section} - Agg ${station}`;
    // A map generator can reuse its previous terminal Rest row as the final wipe
    // hold. Once that row becomes part of the physical wipe, it must stop being
    // treated as terminal or finalization will overwrite the completed wipe.
    if (hold.terminalRest) delete hold.terminalRest;
    if (hold.motionSource === "terminal-end-curve-rest") hold.motionSource = "apl-finished-centerline-completion-v39";
    hold.finishedLabelCenterlineDeg = round(finishedCenterline(section));
    hold.finishedCenterlineCompletionV39 = true;
    if (circularDistance(current, center) <= 0.05) {
      hold.finishedCenterlineRecovered = true;
      return;
    }
    const holdTable = finite(hold.tableAngle, NaN);
    const sequence = stationSequence(machineMap);
    const currentIndex = sequence.findIndex((entry) => Number(entry.station) === Number(station));
    const nextStation = sequence[currentIndex + 1];
    const nextApplication = nextStation ? applicationPoint(machineMap, nextStation.station) : NaN;
    const sameStationSensors = (machineMap?.objects || [])
      .filter((item) => item?.kind === "sensor" && Number(item.station) === Number(station))
      .map((item) => finite(item.angle, finite(item.start, NaN)) - 1.5)
      .filter(Number.isFinite);
    const coding = (machineMap?.objects || []).find((item) => item?.kind === "coding");
    const codingReady = coding ? finite(coding.start, NaN) - finite(global.profileTiming?.codingArriveEarlyDeg, 75) : NaN;
    const candidates = [nextApplication, ...sameStationSensors, codingReady, 359]
      .filter((value) => Number.isFinite(value) && value > holdTable + 0.5)
      .sort((a, b) => a - b);
    const deadline = candidates[0] ?? (holdTable + 1.5);
    const start = holdTable + 0.5;
    let reserve = 0.5;
    if (nextStation && Math.abs(deadline - nextApplication) <= EPS) {
      const nextCenterTarget = applicationTarget(nextStation.section);
      const nextEquivalent = nearestEquivalent(nextCenterTarget, center);
      const nextRotation = Math.abs(nextEquivalent - center);
      const maxRatio = Math.max(0.1, finite(stateRef()?.maxMoveRatio, 21));
      reserve = Math.max(1, nextRotation / maxRatio * 1.1 + 0.5);
    }
    const end = deadline - reserve;
    if (!(end > start + EPS)) {
      addRecoveryIssue(
        `Aggregate ${station} completes the ${section} wipe at ${round(current)} deg, but the finished ${section} centerline is ${round(finishedCenterline(section))} deg and there is no table window to recover that datum before the next machine event. Finish the wipe earlier or move the next event later.`,
        station,
        section
      );
      return;
    }
    insertSorted(rows, makeRow(7, start, current, `Return ${global.sectionLabel?.(section) || section} to Finished Centerline - Agg ${station}`, {
      station,
      section,
      centerlineRecovery: true,
      plannedRotation: center - current,
      finishedLabelCenterlineDeg: round(finishedCenterline(section))
    }));
    insertSorted(rows, makeRow(3, end, center, `Hold Finished ${global.sectionLabel?.(section) || section} Centerline - Agg ${station}`, {
      station,
      section,
      centerlineRecovery: true,
      finishedCenterlineRecovered: true,
      finishedLabelCenterlineDeg: round(finishedCenterline(section))
    }));
  }

  function recomputeTransitions(rows) {
    rows.sort((left, right) => finite(left?.tableAngle, 0) - finite(right?.tableAngle, 0));
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      row.hmi = index + 1;
      row.plc = index;
      if (Number(row?.cmd) !== 7 || !rows[index + 1]) continue;
      const next = rows[index + 1];
      const rotation = finite(next.plateAngle, 0) - finite(row.plateAngle, 0);
      const span = Math.max(EPS, finite(next.tableAngle, 0) - finite(row.tableAngle, 0));
      row.plannedRotation = rotation;
      row.plannedRatio = Math.abs(rotation) / span;
    }
    return rows;
  }

  function correctGeneratedProfile(sourceRows, machineMap) {
    if (String(stateRef()?.applicationMode || "").toLowerCase() !== "apl" || !Array.isArray(sourceRows) || !sourceRows.length || !machineMap) return sourceRows;
    const rows = sourceRows.map((row) => ({ ...row }));
    const sequence = stationSequence(machineMap).map((entry) => ({ ...entry, machineMap }));

    sequence.forEach((descriptor) => ensureApplicationReference(rows, descriptor));

    sequence.forEach((descriptor) => {
      const group = findWipeGroup(rows, descriptor.station, descriptor.section);
      if (!group) return;
      const wipe = solveAplWipe(descriptor.section) || global.sectionWipePlan?.(descriptor.section);
      if (!wipe) return;
      const [firstRotation, secondRotation] = fullWipeRotations(descriptor.section, descriptor.objects, wipe, rows, group);
      const startTarget = applicationTarget(descriptor.section);
      const w1 = rows[group.w1];
      const w2 = rows[group.w2];
      const hold = rows[group.hold];
      const start = nearestEquivalent(startTarget, finite(w1?.plateAngle, startTarget));
      w1.plateAngle = round(start);
      w1.plannedRotation = firstRotation;
      w1.fullPhysicalWipe = true;
      w1.finishedCenterlineCompletionV39 = true;
      w2.plateAngle = round(start + firstRotation);
      w2.plannedRotation = secondRotation;
      w2.fullPhysicalWipe = true;
      w2.finishedCenterlineCompletionV39 = true;
      hold.plateAngle = round(start + firstRotation + secondRotation);
      hold.fullPhysicalWipe = true;
      hold.finishedCenterlineCompletionV39 = true;
      const anchor = rows.find((row) => Number(row?.cmd) === 3
        && isApplicationRow(row, descriptor.station, descriptor.section)
        && finite(row?.tableAngle, Infinity) <= finite(w1.tableAngle, Infinity));
      if (anchor) anchor.plateAngle = round(start);
    });

    sequence.forEach((descriptor) => {
      const group = findWipeGroup(rows, descriptor.station, descriptor.section);
      if (group) ensureFinishedCenterlineRecovery(rows, descriptor, group);
    });

    sequence.forEach((descriptor) => ensureApplicationReference(rows, descriptor));

    const terminalRows = rows.filter((row) => row?.terminalRest || /End Curve\s*-\s*Rest/i.test(text(row?.action)));
    const latest = rows.reduce((winner, row) => !winner || finite(row?.tableAngle, -Infinity) > finite(winner?.tableAngle, -Infinity) ? row : winner, null);
    if (!terminalRows.length) {
      const terminalTable = Math.max(359, finite(latest?.tableAngle, 0) + 0.5);
      rows.push(makeRow(3, terminalTable, finite(latest?.plateAngle, 0), "End Curve - Rest", { terminalRest: true }));
    } else {
      terminalRows.forEach((terminal) => {
        const before = precedingRow(rows, finite(terminal.tableAngle, Infinity));
        if (before && Number(terminal.cmd) === 3 && !terminal.codingHold) terminal.plateAngle = round(finite(before.plateAngle, terminal.plateAngle));
      });
    }

    rows.sort((left, right) => finite(left?.tableAngle, 0) - finite(right?.tableAngle, 0));
    for (let index = rows.length - 2; index >= 0; index -= 1) {
      const row = rows[index];
      const next = rows[index + 1];
      if (row?.finishedCenterlineRecovered
        && Number(row?.cmd) === 3
        && Number(next?.cmd) === 3
        && (next?.terminalRest || /End Curve\s*-\s*Rest/i.test(text(next?.action)))
        && circularDistance(row.plateAngle, next.plateAngle) <= 0.05) rows.splice(index, 1);
    }

    const finalized = recomputeTransitions(rows);
    const target = stateRef();
    target.motionPlan = target.motionPlan && typeof target.motionPlan === "object" ? target.motionPlan : {};
    target.motionPlan.rows = finalized;
    target.motionPlan.applicationDatumOffset = 0;
    target.motionPlan.firstApplicationZeroRebaseRetired = true;
    target.motionPlan.finishedCenterlineCompletionV39 = true;
    target.motionPlan.finishedCenterlines = {
      neck: round(finishedCenterline("neck")),
      body: round(finishedCenterline("body")),
      back: round(finishedCenterline("back"))
    };
    target.motionPlan.neckApplicationTarget = round(applicationTarget("neck"));
    target.motionPlan.bodyApplicationTarget = round(applicationTarget("body"));
    target.motionPlan.backApplicationTarget = round(applicationTarget("back"));
    target.motionPlan.finalPlateAngle = finalized.at(-1)?.plateAngle;
    target.motionPlan.stationPlans = (Array.isArray(target.motionPlan.stationPlans) ? target.motionPlan.stationPlans : []).map((plan) => {
      const descriptor = sequence.find((entry) => Number(entry.station) === Number(plan.station));
      if (!descriptor) return plan;
      const group = findWipeGroup(finalized, descriptor.station, descriptor.section);
      if (!group) return plan;
      const movePath = [finite(finalized[group.w1]?.plannedRotation, 0), finite(finalized[group.w2]?.plannedRotation, 0)];
      return {
        ...plan,
        movePath,
        requiredRotation: movePath.reduce((sum, value) => sum + Math.abs(value), 0),
        directionChanges: Math.sign(movePath[0]) !== Math.sign(movePath[1]) ? 1 : 0,
        finishedCenterlineCompletionV39: true
      };
    });
    return finalized;
  }

  function wrapMapGenerator() {
    const current = global.generatedAplMapDrivenProfile;
    if (typeof current !== "function") return false;
    if (current.finishedCenterlineCompletionV39) return true;
    const base = current;
    const wrapped = function generatedAplMapDrivenProfileWithFinishedCenterlineCompletion(machineMap, ...args) {
      return correctGeneratedProfile(base.call(this, machineMap, ...args), machineMap);
    };
    wrapped.finishedCenterlineCompletionV39 = true;
    wrapped.previousGeneratedAplMapDrivenProfile = base;
    global.generatedAplMapDrivenProfile = wrapped;
    const generator = global.LabelerAplMapProfileGenerator;
    if (generator?.generate) {
      global.LabelerAplMapProfileGenerator = Object.freeze({ ...generator, generate: wrapped, finishedCenterlineCompletionV39: true });
    }
    return true;
  }

  function ensureInstalled() {
    const wipeReady = wrapSectionWipePlan();
    const mapReady = wrapMapGenerator();
    if (!wipeReady || !mapReady) global.setTimeout?.(ensureInstalled, RETRY_MS);
    return wipeReady && mapReady;
  }

  global.LabelerAplFinishedCenterlineCompletion = Object.freeze({
    installed: true,
    VERSION,
    BUILD,
    applicationReference,
    frontCenterline,
    finishedCenterline,
    applicationTarget,
    solveAplWipe,
    stationSequence,
    fullWipeRotations,
    correctGeneratedProfile,
    ensureInstalled
  });

  ensureInstalled();
  global.setTimeout?.(() => {
    if (!global.generatedAplMapDrivenProfile?.finishedCenterlineCompletionV39) wrapMapGenerator();
    if (!global.sectionWipePlan?.finishedCenterlineCompletionV39) wrapSectionWipePlan();
  }, 500);
})(typeof window !== "undefined" ? window : globalThis);