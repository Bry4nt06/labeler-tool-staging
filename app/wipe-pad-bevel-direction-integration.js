"use strict";

(function installWipePadBevelDirectionCorrection(global) {
  if (global.LabelerWipePadBevelDirectionCorrection?.installed) return;
  if (typeof global.drawSpongeWipeDownPad !== "function") {
    throw new Error("ServoForge sponge wipe-down renderer is not available.");
  }

  const baseRenderer = global.LabelerWipeComponentVisualRenderer || {};
  const BEVEL_FACING = "against-machine-direction";

  function machineTrailingPadPath(startAngle, endAngle, centerRadius, widthMapUnits) {
    const start = num(startAngle, 0);
    let end = num(endAngle, start);
    while (end < start) end += 360;

    const width = Math.max(1, num(widthMapUnits, wipeDownPadWidthMapUnits()));
    const innerRadius = Math.max(1, centerRadius - width / 2);
    const outerRadius = Math.max(innerRadius + 0.5, centerRadius + width / 2);
    const span = Math.max(0.1, end - start);
    const physicalBevelDeg = (width / Math.max(1, centerRadius)) * 180 / Math.PI * 0.8;
    const bevelDeg = Math.min(span * 0.38, Math.max(0.75, Math.min(5, physicalBevelDeg)));

    // Logical table angles always increase in machine travel direction. The
    // start of the pad is therefore the machine-trailing side. Chamfer the
    // inner edge at the start so the physical bevel points opposite travel.
    const innerTrailingStart = start + bevelDeg;

    const startOuter = angleToXY(start, outerRadius);
    const endOuter = angleToXY(end, outerRadius);
    const startInner = angleToXY(innerTrailingStart, innerRadius);
    const endInner = angleToXY(end, innerRadius);
    const largeOuter = span > 180 ? 1 : 0;
    const innerSpan = Math.max(0.1, end - innerTrailingStart);
    const largeInner = innerSpan > 180 ? 1 : 0;
    const sweepOuter = state.direction === "cw" ? 0 : 1;
    const sweepInner = sweepOuter ? 0 : 1;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeOuter} ${sweepOuter} ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeInner} ${sweepInner} ${startInner.x} ${startInner.y}`,
      "Z"
    ].join(" ");
  }

  function drawSpongeWipeDownPadAgainstMachineDirection(add, parent, item, centerRadius) {
    ensureWipeComponentVisualDefs(add, parent);
    const widthMapUnits = wipeDownPadWidthMapUnits();
    const d = machineTrailingPadPath(item.start, item.end, centerRadius, widthMapUnits);
    const pad = add("path", {
      d,
      fill: `url(#${WIPE_SPONGE_PATTERN_ID})`,
      stroke: "#7d3511",
      "stroke-width": 1.1,
      "stroke-linejoin": "round",
      "data-wipe-down-pad": item.id,
      "data-pad-width-mm": WIPE_DOWN_PAD_WIDTH_MM,
      "data-sponge-material": "orange-foam",
      "data-bevel-facing": BEVEL_FACING,
      "data-machine-direction": state.direction
    }, parent);
    add("path", {
      d,
      fill: "none",
      stroke: "#ffd09b",
      "stroke-width": 0.55,
      "stroke-opacity": 0.38,
      "pointer-events": "none"
    }, parent);
    return pad;
  }

  // drawConfiguredAssemblies resolves this global binding at render time, so
  // both the Mechanical Map and Simulation receive the corrected geometry.
  global.machineTrailingPadPath = machineTrailingPadPath;
  global.drawSpongeWipeDownPad = drawSpongeWipeDownPadAgainstMachineDirection;
  global.LabelerWipeComponentVisualRenderer = Object.freeze({
    ...baseRenderer,
    machineTrailingPadPath,
    drawSpongeWipeDownPad: drawSpongeWipeDownPadAgainstMachineDirection,
    spongeWipePadsV2: true,
    bevelAgainstMachineDirectionV1: true
  });
  global.LabelerWipePadBevelDirectionCorrection = Object.freeze({
    installed: true,
    version: 1,
    bevelFacing: BEVEL_FACING
  });
})(window);
