"use strict";

(function installAplFinishedCenterlineCompletion(global) {
  if (global.LabelerAplFinishedCenterlineCompletion?.installed) return;

  const VERSION = 2;
  const BUILD = "label-datum-servo-flow-v40";
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
    const mm = finite(stateRef()?.buildInputs?.[`${section}OffsetMm`], 0);
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

  // The shared service owns label dimensions, application reference, and wipe geometry.
  // Keep this exported entry point as an orchestration call, not a second solver.
  function solveAplWipe(section) {
    if (String(stateRef()?.applicationMode || "").toLowerCase() !== "apl") return null;
    return global.sectionWipePlan?.(section) || null;
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
    const seenSections = new Set();
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([station, objects]) => {
        const section = sectionForStation(station, sections);
        const isFirstSectionStation = !seenSections.has(section);
        if (["neck", "body", "back"].includes(section)) seenSections.add(section);
        return { station, objects, section, isFirstSectionStation };
      })
      .filter((entry) => ["neck", "body", "back"].includes(entry.section) && active?.[entry.section] !== false);
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
    if (Number.isFinite(existingFirst) && Number.isFinite(existingSecond)) {
      const second = section === "neck"
        ? global.LabelerGeometryDriver.completeNeckReverseWipe(existingFirst, existingSecond, wipe)
        : existingSecond;
      return [existingFirst, second];
    }
    const firstRequired = Math.abs(finite(wipe?.stages?.[0]?.requiredRotation, finite(wipe?.stageRequired, 0)));
    const secondRequired = Math.abs(finite(wipe?.stages?.[1]?.requiredRotation, finite(wipe?.stageRequired, firstRequired)));
    return [firstRequired * orientation, -secondRequired * orientation];
  }

  function retargetExistingStationReference(rows, descriptor) {
    const { station, section, isFirstSectionStation } = descriptor;
    const group = findWipeGroup(rows, station, section);
    if (!group) return null;
    const targetRaw = applicationTarget(section);
    if (!Number.isFinite(targetRaw)) return null;
    const wipeStartTable = finite(rows[group.w1]?.tableAngle, Infinity);
    const anchor = rows.find((row) => isApplicationRow(row, station, section)
      && Number(row?.cmd) === 3
      && finite(row?.tableAngle, Infinity) <= wipeStartTable + EPS);
    if (!anchor) return null;

    const target = nearestEquivalent(targetRaw, finite(anchor.plateAngle, targetRaw));
    anchor.plateAngle = round(target);
    anchor.finishedLabelCenterlineDeg = round(finishedCenterline(section));
    anchor.labelDatumServoFlowV40 = true;
    anchor.finishedCenterlineCompletionV39 = true;

    const anchorIndex = rows.indexOf(anchor);
    const transition = anchorIndex > 0 ? rows[anchorIndex - 1] : null;
    const transitionBelongsToStation = transition
      && Number(transition?.cmd) === 7
      && rowStation(transition) === Number(station)
      && rowSection(transition) === section;

    if (isFirstSectionStation) {
      anchor.applicationReference = true;
      anchor.applicationReferenceMode = applicationReference(section);
      anchor.finishedLabelReference = "fixed-label-datum";
      if (transitionBelongsToStation) {
        transition.action = `Orient ${global.sectionLabel?.(section) || section} to Tack Reference - Agg ${station}`;
        transition.applicationTransition = true;
        transition.labelDatumServoFlowV40 = true;
      }
    } else {
      anchor.applicationReference = false;
      anchor.wipeResetReference = true;
      anchor.action = `Orient ${global.sectionLabel?.(section) || section} for Re-Wipe - Agg ${station}`;
      delete anchor.initialApplicationDatum;
      delete anchor.applicationDatumOffset;
      if (transitionBelongsToStation) {
        transition.action = `Orient ${global.sectionLabel?.(section) || section} for Re-Wipe - Agg ${station}`;
        transition.applicationTransition = false;
        transition.wipeResetTransition = true;
        transition.labelDatumServoFlowV40 = true;
      }
    }
    return anchor;
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
    if (String(stateRef()?.applicationMode || "").toLowerCase() !== "apl"
      || !Array.isArray(sourceRows) || !sourceRows.length || !machineMap) return sourceRows;

    const rows = sourceRows.map((row) => ({ ...row }));
    const sequence = stationSequence(machineMap);

    // The label centerline is a coordinate on the bottle, not a required servo
    // resting angle. Keep the physical curve continuous and never insert a
    // "return to centerline" move merely to preserve label identity.
    sequence.forEach((descriptor) => retargetExistingStationReference(rows, descriptor));

    sequence.forEach((descriptor) => {
      const group = findWipeGroup(rows, descriptor.station, descriptor.section);
      if (!group) return;
      const wipe = solveAplWipe(descriptor.section) || global.sectionWipePlan?.(descriptor.section);
      if (!wipe) return;
      const [firstRotation, secondRotation] = fullWipeRotations(
        descriptor.section,
        descriptor.objects,
        wipe,
        rows,
        group
      );
      const startTarget = applicationTarget(descriptor.section);
      const w1 = rows[group.w1];
      const w2 = rows[group.w2];
      const hold = rows[group.hold];
      const start = nearestEquivalent(startTarget, finite(w1?.plateAngle, startTarget));

      w1.plateAngle = round(start);
      w1.plannedRotation = firstRotation;
      w1.fullPhysicalWipe = true;
      w1.labelDatumServoFlowV40 = true;
      w1.finishedCenterlineCompletionV39 = true;

      w2.plateAngle = round(start + firstRotation);
      w2.plannedRotation = secondRotation;
      w2.fullPhysicalWipe = true;
      w2.labelDatumServoFlowV40 = true;
      w2.finishedCenterlineCompletionV39 = true;

      hold.plateAngle = round(start + firstRotation + secondRotation);
      hold.action = `Wipe Hold ${global.sectionLabel?.(descriptor.section) || descriptor.section} - Agg ${descriptor.station}`;
      hold.fullPhysicalWipe = true;
      hold.finishedLabelCenterlineDeg = round(finishedCenterline(descriptor.section));
      hold.labelDatumServoFlowV40 = true;
      hold.finishedCenterlineCompletionV39 = true;
      if (hold.terminalRest) delete hold.terminalRest;
      if (hold.motionSource === "terminal-end-curve-rest") hold.motionSource = "apl-label-datum-servo-flow-v40";

      const anchor = rows.find((row) => Number(row?.cmd) === 3
        && rowStation(row) === Number(descriptor.station)
        && rowSection(row) === descriptor.section
        && (row.applicationReference || row.wipeResetReference)
        && finite(row?.tableAngle, Infinity) <= finite(w1.tableAngle, Infinity));
      if (anchor) anchor.plateAngle = round(start);
    });

    const terminalRows = rows.filter((row) => row?.terminalRest || /End Curve\s*-\s*Rest/i.test(text(row?.action)));
    const latest = rows.reduce(
      (winner, row) => !winner || finite(row?.tableAngle, -Infinity) > finite(winner?.tableAngle, -Infinity) ? row : winner,
      null
    );
    if (!terminalRows.length) {
      const terminalTable = Math.max(359, finite(latest?.tableAngle, 0) + 0.5);
      rows.push({
        hmi: 0,
        plc: 0,
        cmd: 3,
        tableAngle: round(terminalTable),
        plateAngle: round(finite(latest?.plateAngle, 0)),
        action: "End Curve - Rest",
        terminalRest: true,
        motionSource: "terminal-end-curve-rest",
        mapDriven: true,
        labelDatumServoFlowV40: true
      });
    }

    const finalized = recomputeTransitions(rows);
    const target = stateRef();
    target.motionPlan = target.motionPlan && typeof target.motionPlan === "object" ? target.motionPlan : {};
    target.motionPlan.rows = finalized;
    target.motionPlan.applicationDatumOffset = 0;
    target.motionPlan.firstApplicationZeroRebaseRetired = true;
    target.motionPlan.finishedCenterlineCompletionV39 = true;
    target.motionPlan.labelDatumServoFlowV40 = true;
    target.motionPlan.centerlineRecoveryRequired = false;
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
      const movePath = [
        finite(finalized[group.w1]?.plannedRotation, 0),
        finite(finalized[group.w2]?.plannedRotation, 0)
      ];
      return {
        ...plan,
        movePath,
        requiredRotation: movePath.reduce((sum, value) => sum + Math.abs(value), 0),
        directionChanges: Math.sign(movePath[0]) !== Math.sign(movePath[1]) ? 1 : 0,
        finishedCenterlineCompletionV39: true,
        labelDatumServoFlowV40: true
      };
    });

    return finalized;
  }

  function wrapMapGenerator() {
    const current = global.generatedAplMapDrivenProfile;
    if (typeof current !== "function") return false;
    if (current.labelDatumServoFlowV40) return true;
    const base = current;
    const wrapped = function generatedAplMapDrivenProfileWithLabelDatumServoFlow(machineMap, ...args) {
      return correctGeneratedProfile(base.call(this, machineMap, ...args), machineMap);
    };
    wrapped.labelDatumServoFlowV40 = true;
    wrapped.finishedCenterlineCompletionV39 = true;
    wrapped.previousGeneratedAplMapDrivenProfile = base;
    global.generatedAplMapDrivenProfile = wrapped;
    const generator = global.LabelerAplMapProfileGenerator;
    if (generator?.generate) {
      global.LabelerAplMapProfileGenerator = Object.freeze({
        ...generator,
        generate: wrapped,
        finishedCenterlineCompletionV39: true,
        labelDatumServoFlowV40: true
      });
    }
    return true;
  }

  function ensureInstalled() {
    const wipeReady = typeof global.sectionWipePlan === "function";
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
    if (!global.generatedAplMapDrivenProfile?.labelDatumServoFlowV40) wrapMapGenerator();
  }, 500);
})(typeof window !== "undefined" ? window : globalThis);
