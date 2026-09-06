"use strict";

(function installTroubleshootingEvidenceClassification(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createTroubleshootingEvidenceClassification() {
  const EVIDENCE_CLASS = Object.freeze({
    UNIVERSAL: Object.freeze({
      id: "universal-method",
      label: "Universal Method",
      shortLabel: "Universal",
      description: "Failure-isolation method that does not depend on one site's PLC tags, alarm numbers, addresses, or controller structure."
    }),
    MACHINE_FAMILY: Object.freeze({
      id: "machine-family-evidence",
      label: "Machine-Family Evidence",
      shortLabel: "Machine family",
      description: "OEM, schematic, family, or machine-revision evidence that can guide the method only when it matches the installed equipment."
    }),
    SITE_PLC: Object.freeze({
      id: "site-plc-evidence",
      label: "Site PLC Evidence",
      shortLabel: "Site PLC",
      description: "Controller-specific evidence whose tags, addresses, rungs, timers, AFIs, I/O names, and implementation stay scoped to the verified site/project."
    })
  });

  const MACHINE_FAMILY_TERMS = /\b(?:apl|autocol|topmodul|topmatic|multimodul|rpc|dart|dartplus|danfoss|krones|automation studio|b&r|power-?pc|kinetix)\b/i;

  function textFor(value) {
    if (Array.isArray(value)) return value.filter(Boolean).join(" ");
    return String(value || "");
  }

  function siteProjectSource(base, source) {
    if (!source) return false;
    const controlKind = base?.SOURCE_KIND?.CONTROL_PROJECT || "PLC/control project";
    return source.kind === controlKind || /\b(?:CO85|LB1|LB2)\b/i.test(textFor([source.id, source.title, source.file]));
  }

  function machineScopedText(value) {
    return MACHINE_FAMILY_TERMS.test(textFor(value));
  }

  function classifySource(base, source) {
    if (!source) return null;
    if (siteProjectSource(base, source)) {
      return Object.freeze({
        ...EVIDENCE_CLASS.SITE_PLC,
        authority: "archived-site-project-evidence",
        activeOverlay: false,
        reason: "This reference is a site/controller project, so its implementation details are local evidence rather than a universal tag standard."
      });
    }
    return Object.freeze({
      ...EVIDENCE_CLASS.MACHINE_FAMILY,
      authority: "reference-evidence",
      activeOverlay: false,
      reason: "This reference is OEM, schematic, procedure, or machine-family evidence and must match the installed equipment/revision before use."
    });
  }

  function classifyEntry(base, entry) {
    if (!entry) return null;
    if (entry.uploadedPlcOverlay) {
      return Object.freeze({
        ...EVIDENCE_CLASS.SITE_PLC,
        authority: entry.uploadedPlcOverlay.authority || "session-site-evidence-only",
        activeOverlay: true,
        reason: "This result came from the PLC currently carried from Analyzer and exists only as site/session evidence."
      });
    }

    const refs = Array.isArray(entry.sourceRefs) ? entry.sourceRefs : [];
    const hasSiteProjectRef = refs.some((ref) => siteProjectSource(base, base.getSource?.(ref.sourceId)));
    if (hasSiteProjectRef) {
      return Object.freeze({
        ...EVIDENCE_CLASS.SITE_PLC,
        authority: "archived-site-project-evidence",
        activeOverlay: false,
        reason: "This diagnostic is backed by a verified site/controller project. The local implementation remains site-specific even when retained in the reference library."
      });
    }

    const scopedText = [entry.id, entry.code, entry.title, entry.category, ...(entry.contextHints || [])];
    if (refs.length || machineScopedText(scopedText)) {
      return Object.freeze({
        ...EVIDENCE_CLASS.MACHINE_FAMILY,
        authority: "machine-family-evidence",
        activeOverlay: false,
        reason: "This diagnostic uses OEM, schematic, family, or machine-revision evidence. Apply the method only after confirming the installed equipment/revision matches."
      });
    }

    return Object.freeze({
      ...EVIDENCE_CLASS.UNIVERSAL,
      authority: "universal-method",
      activeOverlay: false,
      reason: "This path describes a transferable failure-isolation method without relying on a site-specific PLC implementation."
    });
  }

  function classifyFlow(base, flow) {
    if (!flow) return null;
    const scopedText = [flow.id, flow.title, flow.category, ...(flow.contextHints || [])];
    if (machineScopedText(scopedText)) {
      return Object.freeze({
        ...EVIDENCE_CLASS.MACHINE_FAMILY,
        authority: "machine-family-guided-path",
        activeOverlay: false,
        reason: "This guided path is intentionally scoped to a named machine/application family even though it still follows a transferable troubleshooting method."
      });
    }
    return Object.freeze({
      ...EVIDENCE_CLASS.UNIVERSAL,
      authority: "universal-guided-method",
      activeOverlay: false,
      reason: "This guided path starts from symptom/failure mechanism rather than a site-specific PLC tag or alarm namespace."
    });
  }

  return function extendLibrary(base) {
    if (!base?.entries || !base?.flows || !base?.sources || typeof base.getSource !== "function") {
      throw new Error("ServoForge troubleshooting library is required before evidence classification.");
    }

    function getEntryEvidenceClass(entryOrId) {
      const entry = typeof entryOrId === "string" ? base.getEntry?.(entryOrId) : entryOrId;
      return classifyEntry(base, entry);
    }

    function getFlowEvidenceClass(flowOrId) {
      const flow = typeof flowOrId === "string" ? base.getFlow?.(flowOrId) : flowOrId;
      return classifyFlow(base, flow);
    }

    function getSourceEvidenceClass(sourceOrId) {
      const source = typeof sourceOrId === "string" ? base.getSource?.(sourceOrId) : sourceOrId;
      return classifySource(base, source);
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      const errors = [...(current.errors || [])];

      for (const entry of base.entries) {
        const classification = getEntryEvidenceClass(entry);
        if (!classification?.id) errors.push(`Evidence classification missing for diagnostic ${entry.id}.`);
        if (entry.uploadedPlcOverlay && classification?.id !== EVIDENCE_CLASS.SITE_PLC.id) {
          errors.push(`Uploaded PLC diagnostic ${entry.id} must remain Site PLC Evidence.`);
        }
      }
      for (const flow of base.flows) {
        if (!getFlowEvidenceClass(flow)?.id) errors.push(`Evidence classification missing for guided flow ${flow.id}.`);
      }
      for (const source of base.sources) {
        const classification = getSourceEvidenceClass(source);
        if (!classification?.id) errors.push(`Evidence classification missing for source ${source.id}.`);
        if (siteProjectSource(base, source) && classification?.id !== EVIDENCE_CLASS.SITE_PLC.id) {
          errors.push(`Control project source ${source.id} must remain Site PLC Evidence.`);
        }
      }
      if (base.uploadedPlcOverlay?.active && base.uploadedPlcOverlay?.universalLibraryModified !== false) {
        errors.push("Active PLC overlay must not claim to modify the universal troubleshooting library.");
      }

      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+evidence-classification-v371`,
      EVIDENCE_CLASS,
      getEntryEvidenceClass,
      getFlowEvidenceClass,
      getSourceEvidenceClass,
      validate
    });
  };
});
