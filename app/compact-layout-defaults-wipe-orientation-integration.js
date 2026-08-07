"use strict";

(function installCompactLayoutDefaultsAndWipeOrientation(global) {
  if (global.ServoForgeCompactLayoutDefaults?.installed) return;

  const STYLE_ID = "servoforgeCompactValueLayoutV1";
  const SETTINGS_KEY = "labelerToolSettings";
  const THEME_KEY = "labelerThemePreset";
  const PROGRAM_MOVES_MIGRATION_KEY = "servoforge-show-all-program-moves-default-v1";
  const DEFAULT_THEME = "servoforge";
  const DEFAULT_CAP_FILL = "#671018";
  const DEFAULT_CAP_STROKE = "#a83b45";
  const PAD_PATTERN_ID = "servoforge-wipe-sponge-pattern";
  const PAD_WIDTH_MM = 22;

  function readStorage(key) {
    try { return global.localStorage?.getItem(key); }
    catch { return null; }
  }

  function writeStorage(key, value) {
    try {
      global.localStorage?.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function installEffectiveDefaults() {
    // ServoForge is the packaged/default theme. Preserve an explicit user theme,
    // but make first-run/reset sessions land on ServoForge consistently.
    if (!readStorage(THEME_KEY)) writeStorage(THEME_KEY, DEFAULT_THEME);
    if (!state.themePreset) state.themePreset = DEFAULT_THEME;

    // Previous builds shipped this overlay off in the in-memory seed even though
    // company defaults already specified it as on. Migrate existing staging
    // sessions once, then normal user persistence owns the setting afterwards.
    if (readStorage(PROGRAM_MOVES_MIGRATION_KEY) !== "true") {
      state.showAllProgramMovesOverlay = true;
      state.showMoveDistanceOverlay = false;
      const raw = readStorage(SETTINGS_KEY);
      if (raw) {
        try {
          const saved = JSON.parse(raw);
          if (saved && typeof saved === "object") {
            saved.showAllProgramMovesOverlay = true;
            saved.showMoveDistanceOverlay = false;
            writeStorage(SETTINGS_KEY, JSON.stringify(saved));
          }
        } catch {
          // A malformed settings document is handled by the normal persistence layer.
        }
      }
      writeStorage(PROGRAM_MOVES_MIGRATION_KEY, "true");
    } else if (readStorage(SETTINGS_KEY) == null) {
      state.showAllProgramMovesOverlay = true;
      state.showMoveDistanceOverlay = false;
    }
  }

  function installCompactStyles() {
    if (document.getElementById(STYLE_ID)) return false;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* Build Inputs: keep values adjacent to their labels and eliminate the
         artificial 620px second-column minimum that caused horizontal panning. */
      #buildInputs { overflow-x: hidden; }
      #buildInputs .build-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 10px;
        padding: 10px;
      }
      #buildInputs .build-card { width: 100%; min-width: 0; }
      #buildInputs .build-card > label {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(112px, 150px);
        gap: 8px;
        align-items: center;
        margin-bottom: 6px;
        font-size: 12px;
      }
      #buildInputs .build-card > label > input,
      #buildInputs .build-card > label > select {
        width: 100%;
        min-width: 0;
        justify-self: end;
        padding: 5px 6px;
        min-height: 28px;
      }
      #buildInputs .zone-site-selection {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }
      #buildInputs .zone-site-selection label {
        gap: 3px;
        margin-bottom: 4px;
        font-size: 11px;
      }
      #buildInputs .build-card h3 { margin: 11px 0 7px; }
      #buildInputs .build-card h4 { margin: 9px 0 5px; }
      #buildInputs .application-filter-note { margin-bottom: 7px; }
      #buildInputs .build-card table {
        width: 100%;
        min-width: 0;
        table-layout: fixed;
      }
      #buildInputs .build-card table th,
      #buildInputs .build-card table td {
        padding: 4px 6px;
        font-size: 11px;
      }
      #buildInputs .build-card table th:last-child,
      #buildInputs .build-card table td:last-child { width: 112px; }

      /* Specs: use the available panel width instead of forcing a 1205px table.
         Headers may wrap; numeric controls stay narrow and immediately adjacent. */
      #specs .spec-stack { gap: 10px; padding: 10px; }
      #specs .spec-section { min-width: 0; overflow-x: hidden; }
      #bottleSpecs table,
      #labelSpecs .label-specs-table {
        width: 100%;
        min-width: 0 !important;
        table-layout: fixed;
      }
      #bottleSpecs th,
      #bottleSpecs td,
      #labelSpecs .label-specs-table th,
      #labelSpecs .label-specs-table td {
        padding: 3px 3px;
        font-size: 10px;
        line-height: 1.08;
      }
      #bottleSpecs th,
      #labelSpecs .label-specs-table th {
        white-space: normal;
        overflow-wrap: anywhere;
      }
      #bottleSpecs td input,
      #labelSpecs .label-specs-table td input,
      #labelSpecs .label-specs-table td select {
        width: 100%;
        min-width: 0;
        min-height: 24px;
        padding: 3px 4px;
        font-size: 10px;
      }
      #labelSpecs .label-specs-table .info-tip {
        width: 13px;
        min-width: 13px;
        height: 13px;
        font-size: 9px;
      }
      #labelSpecs .label-col-id { width: 26px; }
      #labelSpecs .label-col-brand { width: 100px; }
      #labelSpecs .label-col-spec { width: 58px; }
      #labelSpecs .label-col-application { width: 62px; }
      #labelSpecs .label-col-short { width: 54px; }
      #labelSpecs .label-col-neck-height { width: 58px; }
      #labelSpecs .label-col-neck-length { width: 58px; }
      #labelSpecs .label-col-curve { width: 67px; }
      #labelSpecs .label-col-circ { width: 70px; }
      #labelSpecs .label-col-code { width: 76px; }
      #labelSpecs .label-col-action { width: 39px; }
      #labelSpecs .spec-icon-button,
      #bottleSpecs .spec-icon-button {
        width: 27px;
        min-width: 27px;
        height: 25px;
        min-height: 25px;
        padding: 3px;
      }

      /* Bottle center/cap: dark red instead of the previous blue. */
      #mapSvg [data-bottle-top-view-cap="true"],
      #simulationSvg [data-bottle-top-view-cap="true"] {
        fill: ${DEFAULT_CAP_FILL} !important;
        stroke: ${DEFAULT_CAP_STROKE} !important;
      }

      @media (max-width: 720px) {
        #buildInputs .build-card > label { grid-template-columns: 1fr; }
        #buildInputs .build-card > label > input,
        #buildInputs .build-card > label > select { width: 100%; }
        #buildInputs .zone-site-selection { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  function mapUnitsPerMillimeter() {
    const referenceRadiusMm = Math.abs(Number(state.referencePitchRadiusMm || state.tablePitchRadiusMm) || 0);
    const mapRadius = Math.abs(Number(state.radius) || 0);
    if (!(referenceRadiusMm > 0) || !(mapRadius > 0)) return 1;
    return mapRadius / referenceRadiusMm;
  }

  function sideAwareTrailingPadPath(startAngle, endAngle, centerRadius, widthMapUnits, side = "outer") {
    const start = Number(startAngle) || 0;
    let end = Number(endAngle);
    if (!Number.isFinite(end)) end = start;
    while (end < start) end += 360;

    const width = Math.max(1, Number(widthMapUnits) || PAD_WIDTH_MM * mapUnitsPerMillimeter());
    const innerRadius = Math.max(1, centerRadius - width / 2);
    const outerRadius = Math.max(innerRadius + 0.5, centerRadius + width / 2);
    const span = Math.max(0.1, end - start);
    const physicalBevelDeg = (width / Math.max(1, centerRadius)) * 180 / Math.PI * 0.8;
    const bevelDeg = Math.min(span * 0.38, Math.max(0.75, Math.min(5, physicalBevelDeg)));
    const isInner = String(side) === "inner";

    // Outside wipe-down: bottle is radially inside the pad, so the inner-radius
    // edge carries the bevel. Inside wipe-down: bottle is radially outside the
    // pad, so flip the geometry. The OUTER-radius edge is the short/beveled
    // bottle-contact edge and the INNER-radius edge remains the long edge nearest
    // the center/inside of the machine.
    const outerStartAngle = isInner ? start + bevelDeg : start;
    const innerStartAngle = isInner ? start : start + bevelDeg;
    const startOuter = angleToXY(outerStartAngle, outerRadius);
    const endOuter = angleToXY(end, outerRadius);
    const startInner = angleToXY(innerStartAngle, innerRadius);
    const endInner = angleToXY(end, innerRadius);
    const outerSpan = Math.max(0.1, end - outerStartAngle);
    const innerSpan = Math.max(0.1, end - innerStartAngle);
    const sweepOuter = state.direction === "cw" ? 0 : 1;
    const sweepInner = sweepOuter ? 0 : 1;

    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${outerSpan > 180 ? 1 : 0} ${sweepOuter} ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${innerSpan > 180 ? 1 : 0} ${sweepInner} ${startInner.x} ${startInner.y}`,
      "Z"
    ].join(" ");
  }

  function drawSideAwareSpongePad(add, parent, item, centerRadius) {
    const widthMapUnits = PAD_WIDTH_MM * mapUnitsPerMillimeter();
    const side = String(item?.side || "outer");
    const d = sideAwareTrailingPadPath(item?.start, item?.end, centerRadius, widthMapUnits, side);
    const pad = add("path", {
      d,
      fill: `url(#${PAD_PATTERN_ID})`,
      stroke: "#7d3511",
      "stroke-width": 1.1,
      "stroke-linejoin": "round",
      "data-wipe-down-pad": item?.id || "",
      "data-pad-width-mm": PAD_WIDTH_MM,
      "data-sponge-material": "orange-foam",
      "data-bevel-facing": "against-machine-direction",
      "data-pad-facing": side === "inner" ? "radially-outward-to-bottle" : "radially-inward-to-bottle",
      "data-bevel-contact-side": "bottle",
      "data-long-edge-facing": side === "inner" ? "machine-center" : "machine-outside",
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

    // Contact-face cue: outside pads contact on the inner-radius edge; inside
    // pads contact on the outer-radius edge. This keeps the visual unambiguous.
    const contactRadius = side === "inner" ? centerRadius + widthMapUnits / 2 : centerRadius - widthMapUnits / 2;
    add("path", {
      d: arcPath(Number(item?.start) || 0, Number(item?.end) || Number(item?.start) || 0, contactRadius - 0.35, contactRadius + 0.35),
      fill: "#ffb066",
      "fill-opacity": 0.5,
      stroke: "none",
      "pointer-events": "none",
      "data-pad-contact-face": side === "inner" ? "outer" : "inner"
    }, parent);
    return pad;
  }

  function installWipeOrientationOverride() {
    if (typeof global.drawSpongeWipeDownPad !== "function") return false;
    global.machineTrailingPadPath = sideAwareTrailingPadPath;
    global.drawSpongeWipeDownPad = drawSideAwareSpongePad;
    if (global.LabelerWipeComponentVisualRenderer) {
      global.LabelerWipeComponentVisualRenderer = Object.freeze({
        ...global.LabelerWipeComponentVisualRenderer,
        machineTrailingPadPath: sideAwareTrailingPadPath,
        drawSpongeWipeDownPad: drawSideAwareSpongePad,
        bevelAgainstMachineDirectionV2: true,
        innerPadFacesBottleV1: true,
        innerPadBottleBevelV2: true,
        innerPadLongEdgeInsideV2: true
      });
    }
    return true;
  }

  function installWipeOrientationWhenRendererReady() {
    // This integration can execute before the geometry/planning module finishes
    // loading assembly-map-renderer.js. Applying the override only once at that
    // moment silently left the authoritative renderer unchanged. Apply it now if
    // available, and apply it again after renderer readiness so every map render
    // uses the side-aware inside-pad geometry.
    const installedNow = installWipeOrientationOverride();
    const readiness = global.ServoForgeGeometryPlanningReady;
    if (readiness && typeof readiness.then === "function") {
      readiness.then(() => {
        if (installWipeOrientationOverride() && typeof global.renderMap === "function") {
          global.renderMap();
        }
      }).catch(() => {
        // Startup readiness reports its own failures; the normal renderer remains
        // usable even if this presentation-only correction cannot be reapplied.
      });
    }
    return installedNow;
  }

  installEffectiveDefaults();
  installCompactStyles();
  installWipeOrientationWhenRendererReady();

  global.ServoForgeCompactLayoutDefaults = Object.freeze({
    installed: true,
    defaultTheme: DEFAULT_THEME,
    defaultShowAllProgramMoves: true,
    bottleCenterColor: DEFAULT_CAP_FILL,
    PAD_WIDTH_MM,
    sideAwareTrailingPadPath,
    drawSideAwareSpongePad,
    installEffectiveDefaults,
    installCompactStyles,
    installWipeOrientationOverride,
    installWipeOrientationWhenRendererReady,
    compactValueLayoutV1: true,
    innerPadFacesBottleV1: true,
    innerPadBottleBevelV2: true,
    innerPadLongEdgeInsideV2: true
  });
})(window);
