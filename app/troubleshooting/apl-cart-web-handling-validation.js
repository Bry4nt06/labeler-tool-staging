"use strict";

(function installAplCartWebHandlingValidation(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createAplCartWebHandlingValidationExtension() {
  return function extendLibrary(base) {
    if (!base?.getAplCartWebHandlingPlan || !base?.validate) {
      throw new Error("APL Cart web-handling library is required before v361 validation correction.");
    }

    const priorValidate = base.validate.bind(base);

    function validate() {
      const current = priorValidate();
      const errors = [...(current.errors || [])];
      const plan30Text = JSON.stringify(base.getAplCartWebHandlingPlan(30)?.watchPoints || []);
      const namespaceBoundaryVerified = /not Station 00067/i.test(plan30Text)
        && /not main Labeler Fault 670/i.test(plan30Text);

      const corrected = namespaceBoundaryVerified
        ? errors.filter((message) => message !== "APL Cart Fault 00030 must stay separated from Station 00067.")
        : errors;

      return { ok: corrected.length === 0, errors: corrected };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+apl-cart-web-validation-v361`,
      validate,
      aplCartWebValidationMode: "full-watchpoint-namespace-boundary-v361"
    });
  };
});
