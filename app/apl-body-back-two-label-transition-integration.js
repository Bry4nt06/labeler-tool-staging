"use strict";

(function retireAplBodyBackTwoLabelTransition(global) {
  // RETIRED: Body + Back APL programs must use the same map-driven generator
  // as Neck + Body + Back programs. The active-label state already skips Neck
  // when the recipe does not contain a neck label, so maintaining a second
  // no-neck profile created conflicting tack, wipe and command-chain rules.
  //
  // Keep this compatibility marker because older cached feature manifests may
  // still request this file. It intentionally does not wrap or replace
  // generatedAplMapDrivenProfile.
  global.LabelerAplBodyBackTwoLabelTransition = Object.freeze({
    installed: true,
    retired: true,
    version: 5,
    profileVariant: "common-apl-active-sections",
    motionOwner: "generatedAplMapDrivenProfile",
    reason: "Body + Back is the common APL sequence with Neck inactive."
  });
})(typeof window !== "undefined" ? window : globalThis);
