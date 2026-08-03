"use strict";

(function installLabelSectionEventController(global) {
  if (global.LabelerLabelSectionEventController?.installed) return;

  const validSections = new Set(["neck", "body", "back"]);

  function inferredDefaults(spec) {
    const neck = Math.max(Number(spec?.neckLengthMm) || 0, Number(spec?.neckBottomCurveMm) || 0) > 0;
    const body = (Number(spec?.bodyLengthMm) || 0) > 0;
    const back = (Number(spec?.backLengthMm) || 0) > 0;
    const blank = !neck && !body && !back;
    return {
      neck: blank || neck,
      body: blank || body,
      back: blank || back
    };
  }

  function ensureFlags(spec) {
    const defaults = inferredDefaults(spec);
    const source = spec?.enabledLabelSections && typeof spec.enabledLabelSections === "object"
      ? spec.enabledLabelSections
      : {};
    spec.enabledLabelSections = {
      neck: source.neck === undefined ? defaults.neck : Boolean(source.neck),
      body: source.body === undefined ? defaults.body : Boolean(source.body),
      back: source.back === undefined ? defaults.back : Boolean(source.back)
    };
    return spec.enabledLabelSections;
  }

  function rowContext(target) {
    const section = target.dataset?.labelSection;
    if (!validSections.has(section)) return null;
    const row = target.closest?.('tbody tr[data-spec-library="label"][data-spec-index]');
    const index = Number(row?.dataset.specIndex);
    if (!Number.isInteger(index)) return null;
    return { index, section };
  }

  function setSection(index, section, enabled, checkbox) {
    const spec = state.labelSpecs?.[index];
    if (!spec) return false;
    const current = ensureFlags(spec);
    const next = { ...current, [section]: Boolean(enabled) };
    if (!next.neck && !next.body && !next.back) {
      if (checkbox) checkbox.checked = true;
      global.alert("At least one label section must remain selected.");
      return false;
    }
    spec.enabledLabelSections = next;
    if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    if (typeof render === "function") render();
    return true;
  }

  document.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const context = rowContext(target);
    if (!context) return;
    setSection(context.index, context.section, target.checked, target);
    event.stopImmediatePropagation();
  }, true);

  global.LabelerLabelSectionEventController = Object.freeze({
    installed: true,
    ensureFlags,
    rowContext,
    setSection
  });
})(window);
