"use strict";

function renderBuildInputs() {
  ensureSelectedZoneAndSite();
  window.LabelerLabelCenterlinePolicy?.ensureApplicationReferenceDefaults?.(state);
  const availableLabels = labelSpecsForApplication();
  const brandOptions = availableLabels.map((spec) => spec.brand).filter(Boolean);
  const bottleOptions = state.bottleSpecs.map((spec) => spec.bottleType).filter(Boolean);
  const summary = buildProgramSummary();
  const label = summary.label;
  const bottle = summary.bottle;
  const isColdGlue = state.applicationMode === "cold-glue";
  const bodyCirc = bodyCircumference(bottle);
  const neckCirc = num(label?.neckBottomCircumferenceMm, NaN);
  const neckLabelDeg = degFromMm(label?.neckBottomCurveMm, neckCirc);
  const bodyLabelDeg = degFromMm(label?.bodyLengthMm, bodyCirc);
  const backLabelDeg = degFromMm(label?.backLengthMm, bodyCirc);
  const neckContactDeg = degFromMm(state.buildInputs.neckContactMm, neckCirc);
  const bodyContactDeg = degFromMm(state.buildInputs.bodyContactMm, bodyCirc);
  const backContactDeg = degFromMm(state.buildInputs.backContactMm, bodyCirc);
  const storedFront = num(state.buildInputs.centerLineFrontDeg, NaN);
  const legacyFront = state.buildInputs.neckApplication === "Leading Edge"
    ? Number.isFinite(neckLabelDeg) ? state.buildInputs.plateStartPositionDeg + neckLabelDeg / 2 : 0
    : -(90 - state.buildInputs.neckSpenderPlateDeg) + state.buildInputs.plateStartPositionDeg;
  const centerLineFront = Number.isFinite(storedFront) ? storedFront : legacyFront;
  const centerLineBack = centerLineFront + 180;
  const normalizeReference = (section) => window.LabelerLabelCenterlinePolicy?.applicationReference?.(section)
    || state.buildInputs?.[`${section}ApplicationReference`]
    || (section === "neck" ? "center-tack" : "leading-edge");
  const applicationReferenceOptions = (section) => {
    const selected = normalizeReference(section);
    return `<option value="center-tack"${selected === "center-tack" ? " selected" : ""}>Center Tack</option><option value="leading-edge"${selected === "leading-edge" ? " selected" : ""}>Leading Edge</option>`;
  };
  const neckWrap = typeof selectedNeckWrapPlan === "function" ? selectedNeckWrapPlan() : null;
  const wrapType = neckWrap?.requestedType || "auto";
  const overlapEdge = neckWrap?.overlapEdge || "";
  const fullWrapControlsVisible = neckWrap?.resolvedMode === "full-wrap-overlap";
  const calculatedWrapText = Number.isFinite(neckWrap?.calculatedWrapAngleDeg)
    ? `${fmt(neckWrap.calculatedWrapAngleDeg, 1)}°`
    : "Needs circumference";
  const calculatedOverlapText = neckWrap
    ? `${fmt(neckWrap.calculatedOverlapMm, 1)} mm / ${fmt(neckWrap.calculatedOverlapDeg, 1)}°`
    : "—";
  const overlapTargetValue = neckWrap?.hasOverlapTargetOverride ? neckWrap.targetOverlapMm : "";
  const overlapTargetPlaceholder = neckWrap ? fmt(neckWrap.calculatedOverlapMm, 1) : "0";
  const seamWipeEnabled = neckWrap?.seamWipeEnabled !== false;
  const wrapNotice = (() => {
    if (!neckWrap || neckWrap.detection === "unknown") return { tone: "bad", text: "Enter the effective circumference at the neck-label contact band to calculate the wrap." };
    if (neckWrap.resolvedMode === "full-wrap-overlap" && !neckWrap.overlapEdge) return { tone: "warn", text: `Full neck wrap detected — ${calculatedOverlapText} overlap. Select which edge finishes on top.` };
    if (neckWrap.fullWrapReady) return { tone: "ok", text: `Full neck wrap active — ${fmt(neckWrap.targetOverlapMm, 1)} mm / ${fmt(neckWrap.targetOverlapDeg, 1)}° target overlap with the ${neckWrap.overlapEdge} edge on top.` };
    if (neckWrap.detection === "near-full" && wrapType === "auto") return { tone: "info", text: `Near-full wrap detected at ${calculatedWrapText}. Auto keeps the Standard exit-clearance policy.` };
    if (neckWrap.detection === "overlap-candidate" && wrapType === "standard") return { tone: "warn", text: `The label calculates to ${calculatedWrapText}, but Standard mode keeps opposite-edge crossing prohibited.` };
    return { tone: "info", text: `Standard neck label — ${calculatedWrapText}. The opposite edge remains clear of the final single brush.` };
  })();
  const edgeTitle = (edge) => edge ? `${edge[0].toUpperCase()}${edge.slice(1)} edge` : "Not selected";
  const neckWrapSetup = isColdGlue ? `
        <section class="neck-wrap-setup" aria-labelledby="neckWrapSetupTitle">
          <div class="neck-wrap-heading">
            <div><h4 id="neckWrapSetupTitle">Neck Wrap</h4><p>Uses the developed bottom-edge length and the circumference at the actual label contact band.</p></div>
            <span class="neck-wrap-badge">${calculatedWrapText}</span>
          </div>
          <label>Wrap Type
            <select id="neckWrapType">
              <option value="auto"${wrapType === "auto" ? " selected" : ""}>Auto</option>
              <option value="standard"${wrapType === "standard" ? " selected" : ""}>Standard</option>
              <option value="full-wrap-overlap"${wrapType === "full-wrap-overlap" ? " selected" : ""}>Full Wrap — Overlap</option>
            </select>
          </label>
          <div class="neck-wrap-readout"><span>Calculated overlap</span><strong>${calculatedOverlapText}</strong></div>
          <p class="neck-wrap-notice is-${wrapNotice.tone}" role="status" aria-live="polite">${wrapNotice.text}</p>
          ${fullWrapControlsVisible ? `
            <div class="neck-wrap-overlap-controls">
              <label>Overlap Edge
                <select id="neckOverlapEdge" required aria-required="true">
                  <option value=""${overlapEdge ? "" : " selected"}>Select overlap edge…</option>
                  <option value="leading"${overlapEdge === "leading" ? " selected" : ""}>Leading Edge on Top</option>
                  <option value="trailing"${overlapEdge === "trailing" ? " selected" : ""}>Trailing Edge on Top</option>
                </select>
              </label>
              <label>Overlap Target (mm)
                <input id="neckOverlapTargetMm" type="number" min="0" step="0.1" value="${overlapTargetValue}" placeholder="Auto ${overlapTargetPlaceholder}" aria-describedby="neckOverlapTargetHelp">
                <small id="neckOverlapTargetHelp">Leave blank to use the calculated overlap.</small>
              </label>
              <label class="neck-wrap-switch">Final Seam Wipe
                <input id="neckSeamWipeEnabled" type="checkbox"${seamWipeEnabled ? " checked" : ""}>
              </label>
              <label>Seam Over-Wipe (deg)
                <input id="neckSeamOverWipeDeg" type="number" min="0" max="45" step="0.1" value="${fmt(neckWrap?.seamOverWipeDeg ?? 5, 1)}"${seamWipeEnabled ? "" : " disabled"}>
              </label>
              <div class="neck-wrap-preview" role="img" aria-label="${edgeTitle(neckWrap?.underlyingEdge)} is seated first. ${edgeTitle(neckWrap?.overlapEdge)} crosses the seam and finishes on top.">
                <div class="neck-wrap-ring ${overlapEdge ? `top-${overlapEdge}` : "edge-unselected"}"><span class="neck-wrap-seam"></span><span class="neck-wrap-arrow">↻</span></div>
                <div class="neck-wrap-edge-legend"><span class="underlying-edge">Under: ${edgeTitle(neckWrap?.underlyingEdge)}</span><span class="top-edge">Top: ${edgeTitle(neckWrap?.overlapEdge)}</span></div>
              </div>
            </div>` : ""}
        </section>` : "";
  const modeSpecificInputs = isColdGlue
    ? `
        <h3>Cold Glue Program Parameters</h3>
        <p class="application-filter-note">Cold Glue uses center-tack application and map-defined brush channels.</p>
        <label>Starting Servo Position (deg) <input id="plateStartPositionDeg" type="number" step="0.1" value="${state.buildInputs.plateStartPositionDeg}"></label>
        <label>Neck Contact Parameter (deg) <input id="programNeckContactDeg" type="number" min="0" step="0.001" value="${fmt(neckContactDeg, 3)}"></label>
        <label>Body Contact Parameter (deg) <input id="programBodyContactDeg" type="number" min="0" step="0.001" value="${fmt(bodyContactDeg, 3)}"></label>
        <label>Back Contact Parameter (deg) <input id="programBackContactDeg" type="number" min="0" step="0.001" value="${fmt(backContactDeg, 3)}"></label>
        <label>Neck Over-Wipe (deg) <input id="neckOverWipeDeg" type="number" min="0" step="0.1" value="${state.buildInputs.neckOverWipeDeg}"></label>
        <label>Body Over-Wipe (deg) <input id="bodyOverWipeDeg" type="number" min="0" step="0.1" value="${state.buildInputs.bodyOverWipeDeg}"></label>
        <label>Back Over-Wipe (deg) <input id="backOverWipeDeg" type="number" min="0" step="0.1" value="${state.buildInputs.backOverWipeDeg}"></label>
        <label>Maximum Turn Speed Threshold <input id="programMaxMoveRatio" type="number" min="0.1" step="0.1" value="${state.maxMoveRatio}"></label>`
    : `
        <h3>APL Program Parameters</h3>
        <label>Neck Spender Plate Angle <input id="neckSpenderPlateDeg" type="number" step="0.1" value="${state.buildInputs.neckSpenderPlateDeg}"></label>
        <h4>Label Application Reference</h4>
        <p class="application-filter-note">Application Reference controls where the bottle is positioned when the label first tacks. Finished label centerlines remain the physical reference used by wipe-down alignment and label sensors.</p>
        <label>Neck Application Reference <select id="neckApplicationReference">${applicationReferenceOptions("neck")}</select></label>
        <label>Body Application Reference <select id="bodyApplicationReference">${applicationReferenceOptions("body")}</select></label>
        <label>Back Application Reference <select id="backApplicationReference">${applicationReferenceOptions("back")}</select></label>
        <label>Center Line Front (deg) <input id="programCenterLineFrontDeg" type="number" step="0.1" value="${fmt(centerLineFront, 3)}"></label>
        <label>Center Line Back (deg) <input id="programCenterLineBackDeg" type="number" step="0.1" value="${fmt(centerLineBack, 3)}"></label>
        <label>Neck Contact Parameter (deg) <input id="programNeckContactDeg" type="number" min="0" step="0.001" value="${fmt(neckContactDeg, 3)}"></label>
        <label>Body Contact Parameter (deg) <input id="programBodyContactDeg" type="number" min="0" step="0.001" value="${fmt(bodyContactDeg, 3)}"></label>
        <label>Back Contact Parameter (deg) <input id="programBackContactDeg" type="number" min="0" step="0.001" value="${fmt(backContactDeg, 3)}"></label>
        <label>Neck Over-Wipe (deg) <input id="neckOverWipeDeg" type="number" min="0" step="0.1" value="${state.buildInputs.neckOverWipeDeg}"></label>
        <label>Body Over-Wipe (deg) <input id="bodyOverWipeDeg" type="number" min="0" step="0.1" value="${state.buildInputs.bodyOverWipeDeg}"></label>
        <label>Back Over-Wipe (deg) <input id="backOverWipeDeg" type="number" min="0" step="0.1" value="${state.buildInputs.backOverWipeDeg}"></label>
        <label>Starting Servo Position (deg) <input id="plateStartPositionDeg" type="number" step="0.1" value="${state.buildInputs.plateStartPositionDeg}"></label>
        <label>Neck Label Offset (mm) <input id="neckOffsetMm" type="number" step="0.1" value="${state.buildInputs.neckOffsetMm}"></label>
        <label>Body Label Offset (mm) <input id="bodyOffsetMm" type="number" step="0.1" value="${state.buildInputs.bodyOffsetMm}"></label>
        <label>Back Label Offset (mm) <input id="backOffsetMm" type="number" step="0.1" value="${state.buildInputs.backOffsetMm}"></label>
        <label>Back Inspection Offset (mm) <input id="backInspectionOffsetMm" type="number" step="0.1" value="${state.buildInputs.backInspectionOffsetMm}"></label>
        <label>Code Box Center From Left Label Edge (deg) <input id="programCodeBoxCenterDeg" type="number" min="0" step="0.001" value="${fmt(degFromMm(label?.codeBoxCenterMm, bodyCirc), 3)}"></label>`;
  els.buildInputs.innerHTML = `
    <div class="build-grid">
      <div class="build-card">
        <h2>Build Program Inputs</h2>
        <div class="application-filter-note">Showing ${state.applicationMode === "cold-glue" ? "Cold Glue" : "APL"} brand profiles only.</div>
        <div class="zone-site-selection">
          <label>Zone <select id="zoneSelect">${optionList(zoneNames(), state.selectedZone)}</select></label>
          <label>Site <select id="siteSelect"${sitesForZone(state.selectedZone).length ? "" : " disabled"}>${sitesForZone(state.selectedZone).length ? optionList(sitesForZone(state.selectedZone), state.selectedSite) : '<option value="">No sites configured</option>'}</select></label>
        </div>
        <label>Brand <select id="brandSelect"${brandOptions.length ? "" : " disabled"}>${brandOptions.length ? optionList(brandOptions, state.selectedBrand) : `<option value="">No ${state.applicationMode === "cold-glue" ? "Cold Glue" : "APL"} brands assigned</option>`}</select></label>
        <label>Bottle Type <select id="bottleSelect">${optionList(bottleOptions, state.selectedBottle)}</select></label>
        <h3>Label &amp; Bottle Geometry</h3>
        <label>Neck Label Bottom Curvature (mm) <input id="programNeckCurveMm" type="number" min="0" step="0.001" value="${label?.neckBottomCurveMm ?? 0}"></label>
        <label>Body Label Length (mm) <input id="programBodyLengthMm" type="number" min="0" step="0.001" value="${label?.bodyLengthMm ?? 0}"></label>
        <label>Back Label Length (mm) <input id="programBackLengthMm" type="number" min="0" step="0.001" value="${label?.backLengthMm ?? 0}"></label>
        <label>Bottle Circ @ Neck Label Bottom (mm) <input id="programNeckCircMm" type="number" min="0.001" step="0.001" value="${label?.neckBottomCircumferenceMm ?? 0}"></label>
        <label>Bottle Body/Back Circumference (mm) <input id="programBodyCircMm" type="number" min="0.001" step="0.001" value="${fmt(bodyCirc, 3)}"></label>
        <label>Neck Label Length (deg) <input id="programNeckLabelDeg" type="number" min="0" step="0.001" value="${fmt(neckLabelDeg, 3)}"></label>
        ${neckWrapSetup}
        <label>Body Label Length (deg) <input id="programBodyLabelDeg" type="number" min="0" step="0.001" value="${fmt(bodyLabelDeg, 3)}"></label>
        <label>Back Label Length (deg) <input id="programBackLabelDeg" type="number" min="0" step="0.001" value="${fmt(backLabelDeg, 3)}"></label>
        ${modeSpecificInputs}
        <h3>Machine Feed Parameters</h3>
        <label>Current Head Pitch (deg) <input id="programHeadPitchDeg" type="number" min="0.1" step="0.001" value="${fmt(360 / state.headCount, 3)}"></label>
        <label>Table Map Scale <input id="programTableMapScale" type="number" min="0.001" step="0.001" value="${fmt(state.autoScaleTableMap ? state.referencePitchRadiusMm / state.tablePitchRadiusMm : 1, 3)}"></label>
        <label>Encoder Counts / Plate Rev <input id="programEncoderCountsPlateRev" type="number" min="1" step="1" value="${fmt(state.encoderCountsPerRev * state.servoGearRatio, 3)}"></label>
      </div>
      <div class="build-card">
        <h2>Workbook Feed Check</h2>
        <table><thead><tr><th>Build Program Field</th><th>Value</th></tr></thead><tbody>${summary.rows.map(([label, value]) => `<tr><td>${label}</td><td class="num">${typeof value === "number" ? fmt(value, 3) : value}</td></tr>`).join("")}</tbody></table>
      </div>
    </div>`;
}

window.LabelerBuildInputsRenderer = Object.freeze({ renderBuildInputs });
