"use strict";

function generatedAplSeedProfile() {
  const label = selectedLabelSpec();
  const bottle = selectedBottleSpec();
  const bottleCirc = bodyCircumference(bottle);
  const neckCirc = label ? num(label.neckBottomCircumferenceMm, NaN) : NaN;
  const neckDevelopedLengthMm = num(label?.neckBottomCurveMm, 0) > 0
    ? num(label?.neckBottomCurveMm, 0)
    : num(label?.neckLengthMm, 0);
  const neckFull = degFromMm(neckDevelopedLengthMm, neckCirc);
  const bodyFull = degFromMm(label?.bodyLengthMm, bottleCirc);
  const backFull = degFromMm(label?.backLengthMm, bottleCirc);
  const scale = (angle) => window.LabelerGeometryDriver?.scaleTableAngle(angle, {
    enabled: state.autoScaleTableMap,
    currentPitchRadiusMm: state.tablePitchRadiusMm,
    referencePitchRadiusMm: state.referencePitchRadiusMm,
    zeroAngle: state.zeroAngle
  }) ?? angle;
  const point = (pattern, fallback) => {
    const value = mapPointAngle(pattern);
    return Number.isFinite(value) ? value : fallback;
  };
  const map = typeof activeMachineMap === "function" ? activeMachineMap() : null;
  const pad3 = padProfileTableAngles(3);
  const pad4 = padProfileTableAngles(4);


  // The coding target is reached before the physical coding object and the
  // terminal CMD 3 holds that orientation through the complete coding window.
  const referenceTablePath = [
    seed[0]?.tableAngle,
    seed[1]?.tableAngle,
    seed[2]?.tableAngle,
    seed[3]?.tableAngle,
    seed[4]?.tableAngle,
    seed[5]?.tableAngle,
    seed[6]?.tableAngle,
    seed[7]?.tableAngle,
    seed[8]?.tableAngle,
    scale(point(/Agg 3 (?:Spender|Pallet)/i, 148.5) - profileTiming.spenderArriveEarly),
    scale(pad3[0]), scale(pad3[1]), scale(pad3[2]), scale(pad3[3]),
    scale(point(/Agg 4 (?:Spender|Pallet)/i, 188.5) - profileTiming.spenderArriveEarly),
    scale(pad4[0]), scale(pad4[1]), scale(pad4[2]), scale(pad4[3])
  ];

  const plateAngles = [
    seed[0]?.plateAngle,
    seed[1]?.plateAngle,
    seed[2]?.plateAngle,
    seed[3]?.plateAngle,
    seed[4]?.plateAngle,
    seed[5]?.plateAngle,
    seed[6]?.plateAngle,
    seed[7]?.plateAngle,
    seed[8]?.plateAngle,
    seed[11]?.plateAngle,
    seed[12]?.plateAngle,
    seed[13]?.plateAngle,
    seed[14]?.plateAngle,
    seed[15]?.plateAngle,
    seed[16]?.plateAngle,
    seed[17]?.plateAngle,
    seed[18]?.plateAngle,
    seed[19]?.plateAngle
  ];

  const commands = [3, 3, 7, 3, 7, 3, 7, 3, 7, 3, 7, 7, 3, 7, 3, 7, 7, 3];
  const actions = [
    "Zero Line",
    "Hold for Neck Application - Agg 1",
    "Wipe Turn 1 Neck - Agg 1",
    "Wipe Hold Neck - Agg 1",
    "Wipe Turn 2 Neck - Agg 1",
    "Hold for Neck Application - Agg 2",
    "Wipe Turn 1 Neck - Agg 2",
    "Wipe Hold Neck - Agg 2",
    "Wipe Turn 2 Neck - Agg 2",
    "Hold for Body Application - Agg 3",
    "Wipe Turn 1 Body - Agg 3",
    "Wipe Turn 2 Body - Agg 3",
    "Wipe Hold Body - Agg 3",
    "Turn For Body Application - Agg 4",
    "Hold for Body Application - Agg 4",
    "Wipe Turn 1 Body - Agg 4",
    "Wipe Turn 2 Body - Agg 4",
    "Wipe Hold Body - Agg 4"
  ];

  return actions.map((action, index) => ({
    hmi: index + 1,
    plc: index,
    cmd: commands[index],
    tableAngle: finishAngle(referenceTablePath[index]),
    plateAngle: finishAngle(plateAngles[index]),
    action,
    terminalRest: index === actions.length - 1,
    profileSource: "apl-two-label-reference"
  }));
}

window.LabelerAplSeedProfileGenerator = Object.freeze({
  generateSeed: generatedAplSeedProfile,
  generateTwoLabel: generatedAplTwoLabelProfile
});
