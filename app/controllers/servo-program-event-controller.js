"use strict";

(function installServoProgramEventController(global) {
  if (global.LabelerServoProgramEventController?.installed) return;

  const program = global.LabelerServoProgramController;
  if (!program) throw new Error("Servo Program controller is not loaded.");

  function consume(event) {
    event.stopImmediatePropagation();
  }

  function programContext(target) {
    if (!(target instanceof Element) || typeof els === "undefined" || !els.program?.contains(target)) return null;
    const row = target.closest("tr[data-program-hmi]");
    const hmi = Number(row?.dataset.programHmi);
    const field = target.dataset?.programField;
    if (!Number.isFinite(hmi) || !field) return null;
    return { hmi, field };
  }

  function isOverrideField(field) {
    return field === "tableAngle" || field === "plateAngle";
  }

  function stageOverride(target) {
    const context = programContext(target);
    if (!context || !isOverrideField(context.field)) return false;
    program.updateOverride(context.hmi, context.field, target.value);
    return true;
  }

  function commitOverride(target) {
    const context = programContext(target);
    if (!context || !isOverrideField(context.field)) return false;
    program.commitOverride(context.hmi, context.field, target.value);
    return true;
  }

  function updateCommittedField(target) {
    const context = programContext(target);
    if (!context || context.field === "action" || isOverrideField(context.field)) return false;
    if (context.field === "command") program.updateCommand(context.hmi, target.value);
    else return false;
    return true;
  }

  function updateAction(target) {
    const context = programContext(target);
    if (!context || context.field !== "action") return false;
    program.updateAction(context.hmi, target.value);
    return true;
  }

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (stageOverride(target) || updateAction(target)) consume(event);
  }, true);

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (stageOverride(target) || updateCommittedField(target)) consume(event);
  }, true);

  document.addEventListener("focusout", (event) => {
    const target = event.target;
    if (!(target instanceof Element) || !commitOverride(target)) return;
    consume(event);
  }, true);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const context = target instanceof Element ? programContext(target) : null;
    if (!context || !isOverrideField(context.field) || event.key !== "Enter") return;
    event.preventDefault();
    consume(event);
    target.blur?.();
  }, true);

  global.LabelerServoProgramEventController = Object.freeze({
    installed: true,
    programContext,
    isOverrideField,
    stageOverride,
    commitOverride,
    updateCommittedField,
    updateAction
  });
})(window);
