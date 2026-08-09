"use strict";

(function retireAplBodyBackOppositeReference(global) {
  // RETIRED: Finished Body/Back label references are now resolved by the shared
  // label-datum/application-reference policy. A no-neck-only Back target
  // override would make a two-label recipe behave differently from the same
  // machine sequence with the Neck section inactive.
  global.LabelerAplBodyBackOppositeReference = Object.freeze({
    installed: true,
    retired: true,
    version: 5,
    profileVariant: "common-apl-active-sections",
    motionOwner: "LabelerLabelCenterlinePolicy",
    reason: "Body and Back references are derived by the common label-datum policy."
  });
})(typeof window !== "undefined" ? window : globalThis);
