"use strict";

function degFromMm(mm, circumference) {
  return Number.isFinite(mm) && Number.isFinite(circumference) && circumference !== 0 ? (360 * mm) / circumference : null;
}

function nextId(rows) {
  return rows.reduce((highest, row) => Math.max(highest, num(row.id, 0)), 0) + 1;
}

function buildProgramSummary() {
  const label = selectedLabelSpec();
  const bottle = selectedBottleSpec();
  const bottleCirc = bodyCircumference(bottle);
  const neckCirc = label ? num(label.neckBottomCircumferenceMm, NaN) : NaN;
  const neckFullDeg = degFromMm(label?.neckBottomCurveMm, neckCirc);
  const neckContactDeg = degFromMm(state.buildInputs.neckContactMm, neckCirc);
  const bodyContactDeg = degFromMm(state.buildInputs.bodyContactMm, bottleCirc);
  const backContactDeg = degFromMm(state.buildInputs.backContactMm, bottleCirc);
  const centerLineFront = state.buildInputs.neckApplication === "Leading Edge"
    ? Number.isFinite(neckFullDeg) ? state.buildInputs.plateStartPositionDeg + neckFullDeg / 2 : null
    : -(90 - state.buildInputs.neckSpenderPlateDeg) + state.buildInputs.plateStartPositionDeg;
  const centerLineBack = Number.isFinite(centerLineFront) ? centerLineFront + 180 : null;
  const neckWrap = state.applicationMode === "cold-glue" && typeof selectedNeckWrapPlan === "function"
    ? selectedNeckWrapPlan()
    : null;
  const neckWrapRows = neckWrap ? [
    ["Neck Wrap Type", neckWrap.requestedType === "full-wrap-overlap" ? "Full Wrap — Overlap" : neckWrap.requestedType === "standard" ? "Standard" : `Auto → ${neckWrap.resolvedMode === "full-wrap-overlap" ? "Full Wrap — Overlap" : "Standard"}`, "Neck label recipe"],
    ["Calculated Neck Wrap (deg)", fmt(neckWrap.calculatedWrapAngleDeg, 3), "Developed neck-label length / effective contact-band circumference"],
    ["Calculated Neck Overlap (mm / deg)", `${fmt(neckWrap.calculatedOverlapMm, 3)} / ${fmt(neckWrap.calculatedOverlapDeg, 3)}`, "Neck label wrap length minus effective contact-band circumference"],
    ...(neckWrap.resolvedMode === "full-wrap-overlap" ? [
      ["Overlap Edge on Top", neckWrap.overlapEdge ? `${neckWrap.overlapEdge[0].toUpperCase()}${neckWrap.overlapEdge.slice(1)}` : "#REQUIRED", "Neck label recipe"],
      ["Overlap Target (mm / deg)", `${fmt(neckWrap.targetOverlapMm, 3)} / ${fmt(neckWrap.targetOverlapDeg, 3)}`, neckWrap.hasOverlapTargetOverride ? "Operator target" : "Calculated geometry"],
      ["Final Seam Wipe", neckWrap.seamWipeEnabled ? `Enabled • ${fmt(neckWrap.seamOverWipeDeg, 3)} deg` : "Disabled", "Neck label recipe"]
    ] : [["Neck Exit Policy", "Opposite-edge crossing prohibited", "Standard Cold Glue brush policy"]])
  ] : [];
  return {
    label,
    bottle,
    rows: [
      ["Build Program H43 Brand", state.selectedBrand, "Feeds Brand named range"],
      ["Build Program H44 Bottle Type", state.selectedBottle, "Feeds Bottle named range"],
      ["Label Spec Lookup", label?.specNumber ?? "#N/A", "=VLOOKUP(Brand,'Label Specs'!B2:J101,2,FALSE)"],
      ["Bottle Type From Label", label?.bottleType ?? "#N/A", "Label Specs column D"],
      ["Neck Label Bottom Curvature (mm)", label?.neckBottomCurveMm ?? "#N/A", "=VLOOKUP(Brand,'Label Specs'!B2:J101,8,FALSE)"],
      ["Body Label Length (mm)", label?.bodyLengthMm ?? "#N/A", "=VLOOKUP(Brand,'Label Specs'!B2:J101,4,FALSE)"],
      ["Back Label Length (mm)", label?.backLengthMm ?? "#N/A", "=VLOOKUP(Brand,'Label Specs'!B2:J101,5,FALSE)"],
      ["Bottle Circ @ Neck Label Bottom (mm)", label?.neckBottomCircumferenceMm ?? "#N/A", "=VLOOKUP(Brand,'Label Specs'!B2:J101,9,FALSE)"],
      ["Bottle Body/Back Circumference (mm)", bottleCirc ?? "#N/A", "=VLOOKUP(Bottle,'Bottle Specs'!B2:F51,5,FALSE)"],
      ["Neck Contact Parameter (deg)", neckContactDeg ?? "#N/A", "=(360*NeckContactMm)/NeckCirc"],
      ["Body Contact Parameter (deg)", bodyContactDeg ?? "#N/A", "=(360*BodyContactMm)/BottleCirc"],
      ["Back Contact Parameter (deg)", backContactDeg ?? "#N/A", "=(360*BackContactMm)/BottleCirc"],
      ["Center Line Front (deg)", centerLineFront ?? "#N/A", "Workbook W9"],
      ["Center Line Back (deg)", centerLineBack ?? "#N/A", "=CenterLineFront+180"],
      ["Neck Label Length (deg)", neckFullDeg ?? "#N/A", "=NeckCurve/NeckCirc*360"],
      ...neckWrapRows,
      ["Body Label Length (deg)", degFromMm(label?.bodyLengthMm, bottleCirc) ?? "#N/A", "=(360*BodyLength)/BottleCirc"],
      ["Back Label Length (deg)", degFromMm(label?.backLengthMm, bottleCirc) ?? "#N/A", "=(360*BackLength)/BottleCirc"],
      ["Code Box Center From Left Label Edge (deg)", degFromMm(label?.codeBoxCenterMm, bottleCirc) ?? "#N/A", "=(360*CodeBoxCenterMm)/BottleCirc"],
      ["Neck Over-Wipe (deg)", state.buildInputs.neckOverWipeDeg, "Workbook Build Program input"],
      ["Body Over-Wipe (deg)", state.buildInputs.bodyOverWipeDeg, "Workbook Build Program input"],
      ["Back Over-Wipe (deg)", state.buildInputs.backOverWipeDeg, "Workbook Build Program input"],
      ["Back Inspection Offset (mm)", state.buildInputs.backInspectionOffsetMm, "Geometry solver"],
      ["Current Head Pitch (deg)", 360 / state.headCount, "360 / head count"],
      ["45-Head Reference Pitch (deg)", 360 / 45, "360 / 45"],
      ["Table Map Scale", state.autoScaleTableMap ? state.referencePitchRadiusMm / state.tablePitchRadiusMm : 1, "reference radius / current radius"],
      ["Encoder Counts / Plate Rev", state.encoderCountsPerRev * state.servoGearRatio, "encoder counts x gear ratio"]
    ]
  };
}
