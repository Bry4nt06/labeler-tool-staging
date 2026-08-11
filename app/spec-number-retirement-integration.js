"use strict";

(function installSpecNumberRetirement(global) {
  if (global.LabelerSpecNumberRetirement?.installed) return;

  const FIELD = "specNumber";
  const DIALOG_ID = "specificationRequiredDialog";
  let printInterceptInstalled = false;

  function runtimeState() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function retireFromState() {
    const source = runtimeState();
    const labels = Array.isArray(source?.labelSpecs) ? source.labelSpecs : [];
    let removed = 0;
    labels.forEach((spec) => {
      if (!spec || !Object.prototype.hasOwnProperty.call(spec, FIELD)) return;
      delete spec[FIELD];
      removed += 1;
    });
    return removed;
  }

  function removeLegacySpecUi(root = document) {
    if (typeof document === "undefined") return;

    document.getElementById(DIALOG_ID)?.remove?.();
    document.querySelectorAll("dialog").forEach((dialog) => {
      if (/\bSpec\s*#\b/i.test(String(dialog.textContent || ""))) dialog.remove?.();
    });

    document.querySelectorAll('[data-spec-field="specNumber"]').forEach((control) => {
      const cell = control.closest?.("td,th");
      if (cell) cell.remove();
      else control.remove?.();
    });

    document.querySelectorAll("#specs th").forEach((header) => {
      if (/^\s*Spec\s*#\s*$/i.test(String(header.textContent || ""))) header.remove();
    });

    document.querySelectorAll("#specs .spec-required-missing").forEach((control) => {
      if (String(control.dataset?.specField || "") !== FIELD) return;
      control.classList.remove("spec-required-missing");
      control.removeAttribute("aria-invalid");
      control.removeAttribute("data-required-message");
    });
  }

  function filteredIssues(source) {
    const requirements = global.LabelerSpecificationRequirements;
    if (!requirements?.validateState || requirements?.specNumberRetiredV1) return [];
    try {
      return requirements.validateState(source).filter((issue) => issue?.field !== FIELD);
    } catch {
      return [];
    }
  }

  function retireRequirements() {
    const current = global.LabelerSpecificationRequirements || {};
    global.LabelerSpecificationRequirements = Object.freeze({
      ...current,
      blocking: false,
      advisoryOnly: true,
      specNumberRetiredV1: true,
      validateState(source = runtimeState()) {
        if (typeof current.validateState !== "function") return [];
        try {
          return current.validateState(source).filter((issue) => issue?.field !== FIELD);
        } catch {
          return [];
        }
      }
    });

    const controller = global.LabelerSpecificationRequiredFieldsController;
    if (controller) {
      global.LabelerSpecificationRequiredFieldsController = Object.freeze({
        ...controller,
        blocking: false,
        specNumberRetiredV1: true,
        validateSpecifications(source = runtimeState()) {
          if (typeof controller.validateSpecifications !== "function") return [];
          try {
            return controller.validateSpecifications(source).filter((issue) => issue?.field !== FIELD);
          } catch {
            return [];
          }
        },
        validateAndPrompt() {
          removeLegacySpecUi();
          return true;
        },
        showRequiredDialog() {
          removeLegacySpecUi();
          return false;
        }
      });
    }
  }

  function printHtmlWithoutSpecNumber(model) {
    const printApi = global.LabelerServoProgramPrint;
    if (!printApi?.printHtml) return "";
    return String(printApi.printHtml(model)).replace(
      /<div class="summary-item(?: wide)?"><span>Spec\s*#<\/span><strong>[\s\S]*?<\/strong><\/div>/i,
      ""
    );
  }

  function openPrintView() {
    const printApi = global.LabelerServoProgramPrint;
    if (!printApi?.printModel || !printApi?.printHtml) return false;

    const popup = global.open("", "_blank", "width=1400,height=900");
    if (!popup) return false;

    const model = printApi.printModel();
    const html = printHtmlWithoutSpecNumber(model);
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    popup.focus?.();
    global.setTimeout(() => popup.print?.(), 120);
    return true;
  }

  function installPrintIntercept() {
    if (printInterceptInstalled || typeof document === "undefined") return;
    printInterceptInstalled = true;
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#printServoProgram");
      if (!button || !global.LabelerServoProgramPrint?.installed) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openPrintView();
    }, true);
  }

  function retireAll() {
    retireFromState();
    retireRequirements();
    if (typeof document !== "undefined") removeLegacySpecUi();
  }

  retireAll();
  installPrintIntercept();

  if (typeof document !== "undefined" && typeof MutationObserver === "function") {
    const observer = new MutationObserver(() => retireAll());
    const startObserver = () => {
      if (document.documentElement) {
        observer.observe(document.documentElement, { childList: true, subtree: true });
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    } else startObserver();
  }

  global.setTimeout?.(retireAll, 0);
  global.setTimeout?.(retireAll, 250);
  global.setTimeout?.(retireAll, 1000);

  global.LabelerSpecNumberRetirement = Object.freeze({
    installed: true,
    version: 1,
    field: FIELD,
    retireFromState,
    removeLegacySpecUi,
    filteredIssues,
    printHtmlWithoutSpecNumber,
    openPrintView,
    specNumberRetiredV1: true
  });
})(typeof window !== "undefined" ? window : globalThis);
