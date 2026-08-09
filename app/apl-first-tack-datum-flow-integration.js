"use strict";

(function installAplFirstTackDatumFlow(global) {
  if (global.LabelerAplFirstTackDatumFlow?.installed) return;

  const VERSION = 2;
  const BUILD = "canonical-body-back-stations-v43";
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

  function policy() {
    return global.LabelerLabelCenterlinePolicy || null;
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
    return 0;
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

    const seen = new Set();
    return [...grouped.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([station, objects]) => {
        const section = sectionForStation(station, sections);
        const isFirstSectionStation = !seen.has(section);
        if (["neck", "body", "back"].includes(section)) seen.add(section);
        return { station, objects, section, isFirstSectionStation };
      })
      .filter((entry) => ["neck", "body", "back"].includes(entry.section) && active?.[entry.section] !== false);
  }

  function finishedCenterlineFromApplication(section, applicationAngle) {
    const api = policy();
    if (api?.finishedCenterlineFromApplication) {
      return finite(api.finishedCenterlineFromApplication(
        section,
        applicationAngle,
        { applicationReferenceMode: applicationReference(section) },
        stateRef()
      ), applicationAngle);
    }
    if (applicationReference(section) !== "leading-edge") return applicationAngle;
    const width = finite(api?.labelWidthDeg?.(section, stateRef()), 0);
    return applicationAngle + width / 2;
  }

  function applicationTargetFromCenterline(section, centerline) {
    const api = policy();
    if (api?.applicationTargetFromCenterline) {
      return finite(api.applicationTargetFromCenterline(
        section,
        centerline,
        applicationReference(section),
        stateRef()
      ), centerline);
    }
    if (applicationReference(section) !== "leading-edge") return centerline;
    const width = finite(api?.labelWidthDeg?.(section, stateRef()), 0);
    return centerline - width / 2;
  }

  function establishDatum(machineMap) {
    const sequence = stationSequence(machineMap);
    const first = sequence[0] || null;
    const startPlate = finite(stateRef()?.buildInputs?.plateStartPositionDeg, 0);
    if (!first) {
      return {
        sequence,
        first: null,
        startPlate,
        front: finite(stateRef()?.buildInputs?.centerLineFrontDeg, 0)
      };
    }

    const firstCenter = finishedCenterlineFromApplication(first.section, startPlate);
    let front = firstCenter;
    if (first.section === "body") front = firstCenter - sectionOffsetDeg("body");
    if (first.section === "back") front = firstCenter - 180 - sectionOffsetDeg("back");

    return {
      sequence,
      first,
      startPlate,
      firstCenter,
      front,
      source: `${first.section}-first-tack`
    };
  }

  function centerlineFor(section, datum) {
    if (section === "back") return datum.front + 180 + sectionOffsetDeg("back");
    if (section === "body") return datum.front + sectionOffsetDeg("body");
    return datum.front;
  }

  function targetFor(section, datum) {
    if (datum.first?.section === section) return datum.startPlate;
    return applicationTargetFromCenterline(section, centerlineFor(section, datum));
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

  function findWipeGroup(rows, station, section) {
    const matches = (row, turn) => rowStation(row) === Number(station)
      && rowSection(row) === section
      && new RegExp(`Wipe\\s+Turn\\s+${turn}`, "i").test(text(row?.action));
    const w1 = rows.findIndex((row) => matches(row, 1));
    if (w1 < 0) return null;
    const w2 = rows.findIndex((row, index) => index > w1 && matches(row, 2));
    if (w2 < 0) return null;
    let hold = -1;
    for (let index = w2 + 1; index < rows.length; index += 1) {
      const row = rows[index];
      if (rowStation(row) === Number(station)
        && rowSection(row) === section
        && Number(row?.cmd) === 3) {
        hold = index;
        break;
      }
    }
    return hold >= 0 ? { w1, w2, hold } : null;
  }

  function referenceRows(rows, descriptor, group) {
    const candidates = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row, index }) => index < group.w1
        && rowStation(row) === Number(descriptor.station)
        && rowSection(row) === descriptor.section
        && Number(row?.cmd) === 3
        && (row?.applicationReference
          || row?.wipeResetReference
          || /Application|Re-Wipe/i.test(text(row?.action))));
    const anchorEntry = candidates.at(-1) || null;
    if (!anchorEntry) return { anchor: null, anchorIndex: -1, transition: null, transitionIndex: -1 };
    const transitionIndex = anchorEntry.index - 1;
    const transition = transitionIndex >= 0 ? rows[transitionIndex] : null;
    const belongs = transition
      && Number(transition?.cmd) === 7
      && rowStation(transition) === Number(descriptor.station)
      && rowSection(transition) === descriptor.section;
    return {
      anchor: anchorEntry.row,
      anchorIndex: anchorEntry.index,
      transition: belongs ? transition : null,
      transitionIndex: belongs ? transitionIndex : -1
    };
  }

  function precedingRow(rows, tableAngle) {
    let result = null;
    rows.forEach((row) => {
      const table = finite(row?.tableAngle, NaN);
      if (!Number.isFinite(table) || table >= tableAngle - EPS) return;
      if (!result || table > finite(result?.tableAngle, -Infinity)) result = row;
    });
    return result;
  }

  function recompute(rows) {
    rows.sort((left, right) => finite(left?.tableAngle, 0) - finite(right?.tableAngle, 0));
    rows.forEach((row, index) => {
      row.hmi = index + 1;
      row.plc = index;
      if (Number(row?.cmd) !== 7 || !rows[index + 1]) return;
      const next = rows[index + 1];
      const rotation = finite(next?.plateAngle, 0) - finite(row?.plateAngle, 0);
      const span = Math.max(EPS, finite(next?.tableAngle, 0) - finite(row?.tableAngle, 0));
      row.plannedRotation = rotation;
      row.plannedRatio = Math.abs(rotation) / span;
    });
    return rows;
  }

  function correctProfile(sourceRows, machineMap, datum) {
    if (!Array.isArray(sourceRows) || !sourceRows.length || !datum?.first) return sourceRows;
    const rows = sourceRows.map((row) => ({ ...row }));
    const firstDescriptor = datum.sequence[0];
    const group = firstDescriptor
      ? findWipeGroup(rows, firstDescriptor.station, firstDescriptor.section)
      : null;

    if (group) {
      const refs = referenceRows(rows, firstDescriptor, group);
      const startPlate = round(datum.startPlate);
      const w1 = rows[group.w1];
      const w2 = rows[group.w2];
      const hold = rows[group.hold];
      const firstRotation = finite(w1?.plannedRotation, finite(w2?.plateAngle, startPlate) - finite(w1?.plateAngle, startPlate));
      const secondRotation = finite(w2?.plannedRotation, finite(hold?.plateAngle, startPlate) - finite(w2?.plateAngle, startPlate));

      if (refs.anchor) {
        refs.anchor.plateAngle = startPlate;
        refs.anchor.applicationReference = true;
        refs.anchor.applicationReferenceMode = applicationReference(firstDescriptor.section);
        refs.anchor.finishedLabelCenterlineDeg = round(centerlineFor(firstDescriptor.section, datum));
        refs.anchor.firstTackDatumFlowV41 = true;
        refs.anchor.canonicalStationResetV43 = true;
        refs.anchor.action = `Hold for ${global.sectionLabel?.(firstDescriptor.section) || firstDescriptor.section} Application - Agg ${firstDescriptor.station}`;
      }

      // The first physical label starts from the configured servo-start datum.
      // Remove only the unnecessary pre-application correction. Every later
      // Body/Back aggregate keeps its normal Correction -> Rest application or
      // re-wipe reference before repeating the same two wipe turns.
      if (refs.transitionIndex >= 0) rows.splice(refs.transitionIndex, 1);

      const refreshed = findWipeGroup(rows, firstDescriptor.station, firstDescriptor.section);
      if (refreshed) {
        const rw1 = rows[refreshed.w1];
        const rw2 = rows[refreshed.w2];
        const rhold = rows[refreshed.hold];
        rw1.plateAngle = startPlate;
        rw1.plannedRotation = firstRotation;
        rw1.firstTackDatumFlowV41 = true;
        rw1.canonicalStationResetV43 = true;
        rw2.plateAngle = round(startPlate + firstRotation);
        rw2.plannedRotation = secondRotation;
        rw2.firstTackDatumFlowV41 = true;
        rw2.canonicalStationResetV43 = true;
        rhold.plateAngle = round(startPlate + firstRotation + secondRotation);
        rhold.firstTackDatumFlowV41 = true;
        rhold.canonicalStationResetV43 = true;
        rhold.finishedLabelCenterlineDeg = round(centerlineFor(firstDescriptor.section, datum));
      }
    }

    // Do not rewrite any later aggregate's wipe path. The v40/common APL layer
    // already owns those rows and matches the canonical 3-label structure:
    // return to the section application reference, CMD 3, then repeat the same
    // two wipe directions. A Body+Back recipe is therefore exactly the normal
    // APL Body+Back station sequence with Neck inactive.
    datum.sequence.slice(1).forEach((descriptor) => {
      const descriptorGroup = findWipeGroup(rows, descriptor.station, descriptor.section);
      if (!descriptorGroup) return;
      const refs = referenceRows(rows, descriptor, descriptorGroup);
      if (refs.anchor) refs.anchor.canonicalStationResetV43 = true;
      if (refs.transition) refs.transition.canonicalStationResetV43 = true;
      rows[descriptorGroup.w1].canonicalStationResetV43 = true;
      rows[descriptorGroup.w2].canonicalStationResetV43 = true;
      rows[descriptorGroup.hold].canonicalStationResetV43 = true;
    });

    const finalized = recompute(rows);
    const target = stateRef();
    target.motionPlan = target.motionPlan && typeof target.motionPlan === "object" ? target.motionPlan : {};
    target.motionPlan.rows = finalized;
    target.motionPlan.firstTackDatumFlowV41 = true;
    target.motionPlan.canonicalStationResetV43 = true;
    target.motionPlan.firstApplicationZeroRebaseRetired = false;
    target.motionPlan.firstApplicationTackAnchoredToServoStart = true;
    target.motionPlan.initialApplicationSection = datum.first.section;
    target.motionPlan.initialApplicationStation = datum.first.station;
    target.motionPlan.establishedFrontCenterlineDeg = round(datum.front);
    target.motionPlan.finishedCenterlines = {
      neck: round(centerlineFor("neck", datum)),
      body: round(centerlineFor("body", datum)),
      back: round(centerlineFor("back", datum))
    };
    target.motionPlan.neckApplicationTarget = round(targetFor("neck", datum));
    target.motionPlan.bodyApplicationTarget = round(targetFor("body", datum));
    target.motionPlan.backApplicationTarget = round(targetFor("back", datum));
    target.motionPlan.finalPlateAngle = finalized.at(-1)?.plateAngle;
    target.motionPlan.stationPlans = (Array.isArray(target.motionPlan.stationPlans) ? target.motionPlan.stationPlans : []).map((plan) => {
      const descriptor = datum.sequence.find((entry) => Number(entry.station) === Number(plan.station));
      if (!descriptor) return plan;
      const descriptorGroup = findWipeGroup(finalized, descriptor.station, descriptor.section);
      if (!descriptorGroup) return plan;
      const movePath = [
        finite(finalized[descriptorGroup.w1]?.plannedRotation, 0),
        finite(finalized[descriptorGroup.w2]?.plannedRotation, 0)
      ];
      return {
        ...plan,
        movePath,
        requiredRotation: movePath.reduce((sum, value) => sum + Math.abs(value), 0),
        directionChanges: Math.sign(movePath[0]) !== Math.sign(movePath[1]) ? 1 : 0,
        firstTackDatumFlowV41: true,
        canonicalStationResetV43: true,
        reWipeContinuation: false,
        reWipeReferenceRestored: !descriptor.isFirstSectionStation
      };
    });
    return finalized;
  }

  function wrapMapGenerator() {
    const current = global.generatedAplMapDrivenProfile;
    if (typeof current !== "function") return false;
    if (current.canonicalStationResetV43) return true;
    const base = current;
    const wrapped = function generatedAplMapDrivenProfileWithCanonicalStationResets(machineMap, ...args) {
      if (String(stateRef()?.applicationMode || "").toLowerCase() !== "apl") {
        return base.call(this, machineMap, ...args);
      }
      const datum = establishDatum(machineMap);
      if (datum?.first && Number.isFinite(datum.front)) {
        stateRef().buildInputs = stateRef().buildInputs && typeof stateRef().buildInputs === "object"
          ? stateRef().buildInputs
          : {};
        // Establish the finished-label coordinate frame before the v40/common
        // generator runs so every Body/Back station receives the same targets
        // it would have in the corresponding three-label program.
        stateRef().buildInputs.centerLineFrontDeg = datum.front;
      }
      return correctProfile(base.call(this, machineMap, ...args), machineMap, datum);
    };
    wrapped.firstTackDatumFlowV41 = true;
    wrapped.canonicalStationResetV43 = true;
    wrapped.previousGeneratedAplMapDrivenProfile = base;
    global.generatedAplMapDrivenProfile = wrapped;

    const generator = global.LabelerAplMapProfileGenerator;
    if (generator?.generate) {
      global.LabelerAplMapProfileGenerator = Object.freeze({
        ...generator,
        generate: wrapped,
        establishDatum,
        firstTackDatumFlowV41: true,
        canonicalStationResetV43: true
      });
    }
    return true;
  }

  function install() {
    if (!wrapMapGenerator()) {
      global.setTimeout?.(install, RETRY_MS);
      return false;
    }
    return true;
  }

  global.LabelerAplFirstTackDatumFlow = Object.freeze({
    installed: true,
    VERSION,
    BUILD,
    stationSequence,
    establishDatum,
    centerlineFor,
    targetFor,
    correctProfile,
    install
  });

  install();
})(typeof window !== "undefined" ? window : globalThis);