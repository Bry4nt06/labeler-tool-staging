"use strict";

function generatedColdGlueFixedProfile() {
  const commandDriver = window.LabelerServoCommandDriver;
  const geometry = window.LabelerGeometryDriver;
  const coldGlueDriver = window.LabelerColdGlueMotionDriver;
  const machineMap = typeof activeMachineMap === "function" ? activeMachineMap() : null;
  const coldGlueSettings = state.coldGlueAggregateSettings || {};
  const applications = selectedLabelApplicationState();
  const activeSections = ["neck", "body", "back"].filter((section) => applications[section]);
  const enabledStations = machineMap
    ? activeSlotNumbers(coldGlueSettings.enabledStations || machineMap.enabledStations)
    : [1, 2, 3];
  const enabledAggregates = machineMap
    ? activeSlotNumbers(coldGlueSettings.enabledAggregates || machineMap.enabledAggregates)
    : [1, 2, 3];
  const stationNumbers = enabledStations.filter((station) => enabledAggregates.includes(station));
  const objects = (Array.isArray(state.coldGlueMap) ? state.coldGlueMap : []).map((item) => ({
    ...item,
    station: Math.max(1, Math.min(6, Math.round(num(item.station, inferredMapObjectStation(item) || 1))))
  }));
  const aggregateAngles = coldGlueSettings.aggregateAngles || machineMap?.aggregateAngles || {};
  const mapDirection = (coldGlueSettings.machineSettings?.direction || machineMap?.machineSettings?.direction) === "ccw" ? "ccw" : "cw";
  const startPlate = num(state.buildInputs.plateStartPositionDeg, 0);
  const aplSeed = generatedAplSeedProfile();
  const applicationTargets = {
    neck: num(aplSeed[1]?.plateAngle, startPlate),
    body: num(aplSeed[11]?.plateAngle, startPlate),
    back: num(aplSeed[21]?.plateAngle, startPlate)
  };
  const rows = [];
  const issues = [];
  const stationPlans = [];
  let plate = startPlate;
  let lastTable = 0;

  const unwrapAfter = (angle, after = lastTable) => {
    let value = norm(num(angle, after));
    while (value <= after + 0.001) value += 360;
    return value;
  };
  const add = (cmd, tableAngle, plateAngle, action, extra = {}) => {
    const rawTable = num(tableAngle, lastTable);
    const normalizedTable = rows.length ? (rawTable < lastTable - 0.001 ? unwrapAfter(rawTable, lastTable) : rawTable) : rawTable;
    rows.push({
      hmi: rows.length + 1,
      plc: rows.length,
      cmd,
      tableAngle: finishAngle(normalizedTable),
      plateAngle: finishAngle(plateAngle),
      action,
      fixedColdGlueMap: false,
      motionSource: "cold-glue-machine-map",
      tackMode: "center",
      centerTackOnly: true,
      centerOutFromApplication: true,
      leadingEdgeWipe: false,
      ...extra
    });
    lastTable = normalizedTable;
  };
  const moveToReference = (targetTable, targetPlate, action, extra = {}) => {
    const target = unwrapAfter(targetTable, lastTable);
    add(7, lastTable, plate, action, extra);
    plate = targetPlate;
    add(3, target, plate, `${action} - Reference`, extra);
  };
  const moveToReferenceWithoutExtraLap = (targetTable, targetPlate, action, extra = {}) => {
    if (Math.abs(norm(num(targetTable, lastTable)) - norm(lastTable)) <= 0.001) {
      add(7, lastTable, plate, action, extra);
      plate = targetPlate;
      add(3, lastTable, plate, `${action} - Reference`, extra);
      return;
    }
    moveToReference(targetTable, targetPlate, action, extra);
  };
  const plateTravelTo = (targetPlate) => Math.abs(((num(targetPlate, plate) - plate + 540) % 360) - 180);
  const moveInWindow = (startTable, endTable, targetPlate, action, extra = {}) => {
    const start = unwrapAfter(startTable, lastTable);
    let end = num(endTable, start);
    while (end <= start + 0.001) end += 360;
    add(7, start, plate, action, extra);
    plate = targetPlate;
    add(3, end, plate, `${action} - Reference`, extra);
  };
  const applyMove = (startAngle, endAngle, rotation, direction, action, extra = {}) => {
    // A wipe may begin exactly where its entry/reference move ended. Equality
    // means "start now", not "wait for the next table revolution".
    let start = norm(num(startAngle, lastTable));
    while (start < lastTable - 0.001) start += 360;
    let end = num(endAngle, start);
    while (end <= start + 0.001) end += 360;
    // The preceding Rest holds the achieved bottle orientation through any
    // open table travel. Start the next Correction at the brush itself; adding
    // a synthetic hold pair creates duplicate CMD 7/3 rows and zero-travel
    // faults on Autocol profiles.
    const { restAction, ...rowExtra } = extra;
    add(7, start, plate, `${action} - Turn`, rowExtra);
    plate += direction * rotation;
    add(3, end, plate, restAction || `${action} - Rest`, rowExtra);
  };
  const pairedBrushPlan = (section, stationObjects) => {
    const wipe = sectionWipePlan(section);
    if (!wipe || !coldGlueDriver) return null;
    const common = {
      labelDeg: wipe.labelDeg,
      // neckOverWipeDeg is an APL pad setting. Cold Glue neck motion uses the
      // physical label length plus the dedicated full-wrap seam-wipe setting.
      overWipeDeg: section === "neck" ? 0 : wipe.overWipeDeg,
      maxRatio: state.maxMoveRatio,
      safetyFactor: 0.9,
      mapDirection,
      wrapPlan: section === "neck" && typeof selectedNeckWrapPlan === "function"
        ? selectedNeckWrapPlan()
        : null
    };
    const channels = stationObjects.filter((item) => item.kind === "brush-channel");
    if (channels.length && typeof coldGlueDriver.createBrushChannelPlan === "function") {
      return coldGlueDriver.createBrushChannelPlan({ ...common, channels });
    }
    const brushes = stationObjects.filter((item) => item.kind === "brush");
    if (brushes.length && typeof coldGlueDriver.createPlan === "function") {
      return coldGlueDriver.createPlan({ ...common, brushes });
    }
    return null;
  };

  add(3, 0, startPlate, "Zero Line");

  // A blank map has no physical device capable of applying or wiping a label.
  // Keep the exported curve legal, but never synthesize an application move
  // from fallback aggregate angles when the map contains no objects.
  if (!objects.length) {
    rows[0] = {
      ...rows[0],
      action: "End Curve - Rest",
      terminalRest: true,
      motionSource: "terminal-end-curve-rest"
    };
    const finalizedBlankRows = commandDriver ? commandDriver.finalize(rows) : rows;
    state.motionPlan = {
      rows: finalizedBlankRows,
      issues: [],
      stationPlans: [],
      pairPlans: [],
      coldGluePlans: {},
      finalPlateAngle: startPlate,
      termination: { section: "none", hmi: 1, tableAngle: 0, command: "Rest" },
      fixedColdGlueMap: false,
      mapDriven: true,
      profileKind: "cold-glue-empty-map"
    };
    return finalizedBlankRows;
  }

  stationNumbers.forEach((station, index) => {
    const section = activeSections[index] || null;
    const stationObjects = objects.filter((item) => Number(item.station) === station);
    const aggregateAngle = num(aggregateAngles[String(station)], num(machineMap?.stationAngles?.[String(station)], station * 40 + 35));
    const stationPlan = section ? pairedBrushPlan(section, stationObjects) : null;
    // Cold-glue brush channels can service more than one label while the same
    // bottle passes them. Once an earlier full-wrap wipe has carried the curve
    // beyond a later aggregate point, do not unwrap that aggregate onto a
    // second revolution. Its label is already on the bottle; continue with the
    // remaining physical brush windows in their actual table order.
    const aggregateAlreadyPassed = aggregateAngle <= lastTable + 0.001;
    if (section && !aggregateAlreadyPassed) {
      const applicationPlate = coldGlueDriver?.applicationTarget
        ? coldGlueDriver.applicationTarget(applicationTargets[section], mapDirection, stationPlan?.labelDeg)
        : applicationTargets[section];
      if (stationPlan?.fullWrap) {
        const applicationStart = unwrapAfter(aggregateAngle + 4, lastTable);
        const applicationTravel = plateTravelTo(applicationPlate) / Math.max(0.1, Math.min(state.maxMoveRatio * 0.9, 11.5));
        moveInWindow(applicationStart, applicationStart + applicationTravel, applicationPlate, `Turn for ${sectionLabel(section)} Application at Aggregate ${station}`, { station, section, fullWrapApplication: true });
      } else {
        moveToReference(aggregateAngle, applicationPlate, `Turn for ${sectionLabel(section)} Application at Aggregate ${station}`, { station, section });
      }
    } else if (!section && stationObjects.length) {
      moveToReference(aggregateAngle, plate, `Aggregate ${station} Entry`, { station });
    }

    if (stationPlan) {
      (stationPlan.issues || []).forEach((issue) => issues.push({ ...issue, station, section }));

      // Cold Glue is center tack only. Complete the orientation move before
      // first brush contact so the center-tacked label faces into the channel.
      // Shared inside/outside brush overlap is a hold zone; bottle rotation is
      // reserved for a one-sided opening after either brush side clears.
      const allBrushAllocations = (Array.isArray(stationPlan.channelMoves) ? stationPlan.channelMoves : [])
        .filter((allocation) => Number.isFinite(num(allocation.start, NaN)))
        .sort((a, b) => num(a.start, 0) - num(b.start, 0));
      const firstBrush = allBrushAllocations[0];
      if (firstBrush && !aggregateAlreadyPassed) {
        const flowFacingPlate = coldGlueDriver?.flowFacingTarget
          ? coldGlueDriver.flowFacingTarget(plate, mapDirection, stationPlan.labelDeg)
          : applicationTargets[section] + (mapDirection === "ccw" ? -90 : 90);
        const brushEntryTable = firstBrush.start - Math.max(0, num(stationPlan.brushEntryLeadDeg, 0));
        const alignmentExtra = { station, section, brushEntryAlignment: true, preBrushRotation: true, centerTackOnly: true, tackMode: "center", leadingEdgeWipe: false, mapDirection, flowFacingOffsetDeg: mapDirection === "ccw" ? 90 : -90 };
        if (stationPlan.fullWrap) {
          const alignmentStart = Math.max(lastTable + 0.5, brushEntryTable - plateTravelTo(flowFacingPlate) / Math.max(0.1, Math.min(state.maxMoveRatio * 0.9, 7.5)));
          moveInWindow(alignmentStart, brushEntryTable, flowFacingPlate, `${sectionLabel(section)} Face Bottle With Flow Before Brush Channel`, alignmentExtra);
        } else {
          moveToReference(brushEntryTable, flowFacingPlate, `${sectionLabel(section)} Pre-Spin Center-Tacked Label Before Brush Contact`, alignmentExtra);
        }
      }

      if (Array.isArray(stationPlan.channelMoves)) {
        const opposedOnlyChannel = stationPlan.channelMoves.length > 0
          && stationPlan.channelMoves.every((allocation) => allocation.stage === "opposed");
        stationPlan.channelMoves.forEach((allocation) => {
          const edgeLabel = allocation.permittedOverlapEdge
            ? `${allocation.permittedOverlapEdge[0].toUpperCase()}${allocation.permittedOverlapEdge.slice(1)}`
            : "";
          const wrapAction = allocation.wrapStage === "first-edge-wipe"
            ? "Full Neck Wrap - First Edge Wipe"
            : allocation.wrapStage === "circumference-wipe"
              ? "Full Neck Wrap - Circumference Wipe"
              : allocation.wrapStage === "overlap-edge-crossing"
                ? `Full Neck Wrap - ${edgeLabel} Edge Crossing`
                : allocation.wrapStage === "seam-wipe"
                  ? "Full Neck Wrap - Seam Wipe"
                  : null;
          const commonExtra = {
            station,
            section,
            brushStage: allocation.stage,
            brushSide: allocation.side || null,
            tackMode: "center",
            centerTackOnly: true,
            centerOutFromApplication: true,
            leadingEdgeWipe: false,
            wrapMode: stationPlan.wrapPlan?.resolvedMode || "standard",
            wrapStage: allocation.wrapStage || null,
            overlapEdge: allocation.permittedOverlapEdge || stationPlan.wrapPlan?.overlapEdge || null,
            underlyingEdge: allocation.underlyingEdge || stationPlan.wrapPlan?.underlyingEdge || null,
            designatedOverlapEdgeCrossing: allocation.wrapStage === "overlap-edge-crossing",
            finalSeamWipe: allocation.wrapStage === "seam-wipe"
          };
          if (allocation.stage === "opposed") {
            const holdAngle = allocation.holdCurrent ? plate : num(allocation.holdAngle, stationPlan.channelEntryAngle ?? 90);
            const action = `${sectionLabel(section)} Parallel Brush Hold at ${finishAngle(holdAngle)}°`;
            if (Math.abs(plate - holdAngle) > 0.001) {
              moveToReferenceWithoutExtraLap(allocation.start, holdAngle, action, {
                ...commonExtra,
                channelHold: true,
                parallelBrushHold: true,
                holdAngle,
                brushHoldUntil: allocation.end
              });
            } else {
              const currentRest = rows[rows.length - 1];
              if (Number(currentRest?.cmd) === 3) {
                currentRest.action = action;
                currentRest.channelHold = true;
                currentRest.parallelBrushHold = true;
                currentRest.holdAngle = finishAngle(holdAngle);
                currentRest.brushHoldFrom = finishAngle(allocation.start);
                currentRest.brushHoldUntil = finishAngle(Math.max(num(currentRest.brushHoldUntil, allocation.start), allocation.end));
                currentRest.brushStage = "opposed";
                currentRest.centerTackOnly = true;
                currentRest.tackMode = "center";
                currentRest.leadingEdgeWipe = false;
              }
            }
            if (opposedOnlyChannel) {
              add(3, allocation.end, holdAngle, `${action} - Equal-Length Channel Exit Hold`, {
                ...commonExtra,
                brushStage: "opposed-exit",
                channelHold: true,
                parallelBrushHold: true,
                equalLengthChannel: true,
                holdAngle,
                brushHoldFrom: finishAngle(allocation.start),
                brushHoldUntil: finishAngle(allocation.end)
              });
            }
            return;
          }
          if (allocation.rotation > 0.001) {
            applyMove(
              allocation.start,
              allocation.end,
              allocation.rotation,
              allocation.direction,
              wrapAction || `${sectionLabel(section)} ${allocation.stage === "outer" ? "Outside" : "Inside"} Brush Opening Center-Out Wipe`,
              {
                ...commonExtra,
                singleSideOpening: true,
                wipeOutward: true,
                plannedRotation: allocation.rotation,
                plannedRatio: allocation.ratio,
                centerTackStage: allocation.centerTackStage,
                restAction: allocation.wrapStage === "seam-wipe" ? "Full Neck Wrap - Exit Rest" : null
              }
            );
          }
        });
      }
    } else if (section) {
      issues.push({ level: "bad", code: "cold-glue-missing-brush-station", station, section, message: `Aggregate ${station} is assigned to the ${section} label but has no complete outside/inside brush set.` });
    }

    const rollers = stationObjects.filter((item) => item.kind === "roller").sort((a, b) => num(a.start, a.angle) - num(b.start, b.angle));
    rollers.forEach((roller) => {
      const start = num(roller.start, roller.angle);
      const end = num(roller.end, start + 0.5);
      applyMove(start, end, 0, 1, roller.name || `Aggregate ${station} Roller Pass`, { station, rollerPass: true });
    });
    if (section) stationObjects
      .filter((item) => item.kind === "sensor" && item.servoAssist)
      .sort((a, b) => num(a.angle, a.start) - num(b.angle, b.start))
      .forEach((sensor) => {
        const wipe = sectionWipePlan(section);
        const placement = num(sensor.angle, sensor.start);
        const ready = placement - 1.5;
        const requiredVisibility = Math.min(100, Math.max(1, num(sensor.requiredVisibilityPercent, 50)));
        const sensorLabelCenter = labelSensorInspectionCenter(section, applicationTargets[section], wipe?.labelDeg);
        const visibility = labelSensorVisibility(sensorLabelCenter, plate, wipe?.labelDeg, 180);
        if (visibility.percent >= requiredVisibility) {
          lastTable = Math.max(lastTable, placement + 1.5);
          return;
        }
        if (ready <= lastTable + 0.5) {
          issues.push({ level: "bad", code: "label-sensor-turn-window", station, section, message: `${sensor.name || "Label Sensor"} needs a bottle-orientation turn, but its 3 deg window starts at ${ready.toFixed(1)} deg after the previous motion ends at ${lastTable.toFixed(1)} deg. Move the sensor later or finish the brush wipe earlier.` });
          return;
        }
        const plan = nearestLabelSensorTarget(plate, sensorLabelCenter, wipe?.labelDeg, requiredVisibility, 180);
        moveToReference(ready, plan.target, `Orient ${sectionLabel(section)} Label for Sensor - Station ${station}`, { station, section, sensorId: sensor.id, sensorPlacement: placement, sensorFieldOfViewDeg: 180, requiredLabelVisibilityPercent: requiredVisibility, plannedLabelVisibilityPercent: plan.visibility.percent });
        // A sensor placement represents a centered three-degree inspection
        // window. Keep the achieved Rest active through the complete window;
        // the following station may not begin a new turn until after it ends.
        lastTable = Math.max(lastTable, placement + 1.5);
      });
    stationPlans.push({ station, section, aggregateAngle, objects: stationObjects, plan: stationPlan });
  });

  const remainingObjects = objects
    .filter((item) => !stationNumbers.includes(Number(item.station)))
    .sort((a, b) => num(a.start, a.angle) - num(b.start, b.angle));
  remainingObjects.filter((item) => item.kind === "roller").forEach((roller) => {
    applyMove(num(roller.start, roller.angle), num(roller.end, num(roller.start, roller.angle) + 0.5), 0, 1, roller.name || "Final Roller Pass", { rollerPass: true });
  });

  const finalObjectAngle = objects.reduce((best, item) => Math.max(best, num(item.end, num(item.angle, num(item.start, 0)))), 0);
  const endCurveAngle = unwrapAfter(finalObjectAngle || (lastTable + Math.max(0.5, 360 / Math.max(1, state.headCount))), lastTable);
  if (Number(rows[rows.length - 1]?.cmd) === 3) {
    rows[rows.length - 1] = { ...rows[rows.length - 1], tableAngle: finishAngle(endCurveAngle), action: "End Curve - Rest", terminalRest: true, motionSource: "terminal-end-curve-rest" };
    lastTable = endCurveAngle;
  } else {
    add(3, endCurveAngle, plate, "End Curve - Rest", { terminalRest: true, motionSource: "terminal-end-curve-rest" });
  }

  const finalized = commandDriver ? commandDriver.finalize(rows) : rows;
  state.motionPlan = {
    rows: finalized,
    issues,
    stationPlans,
    pairPlans: [],
    coldGluePlans: Object.fromEntries(stationPlans.filter((plan) => plan.section).map((plan) => [plan.section, plan.plan])),
    finalPlateAngle: finalized[finalized.length - 1]?.plateAngle,
    termination: {
      section: activeSections[activeSections.length - 1] || "none",
      hmi: finalized.length,
      tableAngle: endCurveAngle,
      command: "Rest"
    },
    fixedColdGlueMap: false,
    mapDriven: true
  };
  return finalized;
}

window.LabelerColdGlueProfileGenerator = Object.freeze({ generate: generatedColdGlueFixedProfile });