"use strict";

function servoOverrideProfileKey() {
  return [
    state.activeMapId || "no-map",
    state.applicationMode || "apl",
    state.selectedBrand || "no-brand",
    state.selectedBottle || "no-bottle"
  ].join("|");
}

function servoOverrideFieldMetadata(field) {
  if (field === "tableAngle") {
    return Object.freeze({ overrideField: "tableAngleOverride", generatedField: "generatedTableAngle" });
  }
  if (field === "plateAngle") {
    return Object.freeze({ overrideField: "plateAngleOverride", generatedField: "generatedPlateAngle" });
  }
  return null;
}

function setServoAngleOverride(row, field, rawValue) {
  const metadata = servoOverrideFieldMetadata(field);
  if (!row || !metadata) return false;

  if (!state.servoOverrides || typeof state.servoOverrides !== "object") state.servoOverrides = {};
  const profileKey = servoOverrideProfileKey();
  const rowKey = String(row.plc ?? Math.max(0, Number(row.hmi) - 1));
  const profileOverrides = { ...(state.servoOverrides[profileKey] || {}) };
  const rowOverrides = { ...(profileOverrides[rowKey] || {}) };
  const raw = String(rawValue ?? "").trim();
  const clearing = raw === "";
  const parsed = clearing ? null : Number(raw);

  // Number inputs can briefly expose an invalid intermediate value while the
  // user is typing (for example a leading minus sign). Keep the current edit
  // intact instead of replacing it with a generated or fallback value.
  if (!clearing && !Number.isFinite(parsed)) return false;

  if (clearing) delete rowOverrides[field];
  else rowOverrides[field] = parsed;

  if (Object.keys(rowOverrides).length) profileOverrides[rowKey] = rowOverrides;
  else delete profileOverrides[rowKey];
  if (Object.keys(profileOverrides).length) state.servoOverrides[profileKey] = profileOverrides;
  else delete state.servoOverrides[profileKey];

  // Keep the live generated row synchronized with the edit immediately. The
  // previous implementation only changed the hidden override store, so any
  // incidental Servo Program redraw could restore the stale row value while
  // the field was still being edited.
  row[metadata.overrideField] = clearing ? null : parsed;
  if (clearing) {
    const generated = Number(row[metadata.generatedField]);
    if (Number.isFinite(generated)) row[field] = generated;
  } else {
    row[field] = parsed;
  }

  return true;
}

function applyGeneratedServoProfile() {
  const generated = applyMachineTypeProfileFraming(generatedServoProfile());
  const profileKey = servoOverrideProfileKey();
  const overrides = state.servoOverrides?.[profileKey] || {};
  state.program = generated.map((row, index) => {
    const override = overrides[String(row.plc ?? index)] || {};
    return {
      ...row,
      generatedTableAngle: row.tableAngle,
      generatedPlateAngle: row.plateAngle,
      tableAngle: Number.isFinite(Number(override.tableAngle)) ? Number(override.tableAngle) : row.tableAngle,
      plateAngle: Number.isFinite(Number(override.plateAngle)) ? Number(override.plateAngle) : row.plateAngle,
      tableAngleOverride: Number.isFinite(Number(override.tableAngle)) ? Number(override.tableAngle) : null,
      plateAngleOverride: Number.isFinite(Number(override.plateAngle)) ? Number(override.plateAngle) : null
    };
  });
}

window.LabelerServoOverrideService = Object.freeze({
  profileKey: servoOverrideProfileKey,
  fieldMetadata: servoOverrideFieldMetadata,
  setAngle: setServoAngleOverride,
  applyGeneratedProfile: applyGeneratedServoProfile
});
