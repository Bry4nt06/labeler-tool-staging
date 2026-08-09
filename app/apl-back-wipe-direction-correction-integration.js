"use strict";

(function retireAplBackWipeDirectionCorrection(global) {
  // RETIRED: Back wipe direction is resolved by the common APL geometry/contact
  // path. Reversing an already-generated Back wipe only for no-neck recipes
  // made Body + Back programs diverge from the equivalent three-label program
  // with Neck disabled and could create invalid correction chains.
  //
  // This marker remains so older feature manifests can load the path safely.
  global.LabelerAplBackWipeDirectionCorrection = Object.freeze({
    installed: true,
    retired: true,
    version: 5,
    profileVariant: "common-apl-active-sections",
    motionOwner: "generatedAplMapDrivenProfile",
    reason: "Back wipe direction is owned by common APL contact geometry."
  });
})(typeof window !== "undefined" ? window : globalThis);
