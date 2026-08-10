"use strict";

(function installOrientationIssueFactoryDriver(global) {
  if (global.LabelerOrientationIssueFactoryDriver) return;

  function issue({ level = "bad", code, item, section, message, extras = {} } = {}) {
    return {
      level,
      code,
      objectId: item?.id,
      station: item?.station,
      section,
      message,
      ...extras,
      issueFactoryDriver: "profile.orientationIssueFactory"
    };
  }

  function labelInactive({ item, section, label, sectionName }) {
    return issue({
      code: "map-object-label-inactive",
      item,
      section,
      message: `${label} targets the ${sectionName} label, but that label is not active.`
    });
  }

  function beforeApplication({ item, section, label, sectionName }) {
    return issue({
      code: "map-object-before-label-application",
      item,
      section,
      message: `${label} is positioned before the ${sectionName} label has been applied.`
    });
  }

  function noReference({ item, section, label }) {
    return issue({
      code: "map-object-orientation-no-reference",
      item,
      section,
      message: `${label} has no prior servo state from which to calculate its orientation turn.`
    });
  }

  function windowOverlap({ item, section, label, span }) {
    return issue({
      code: "map-object-window-overlap",
      item,
      section,
      message: `${label} overlaps an existing servo event inside its ${span}° object window.`
    });
  }

  function physicalWipeOverlap({ item, section, label, action }) {
    return issue({
      code: "map-object-overlaps-physical-wipe",
      item,
      section,
      message: `${label} begins while "${action || "the current wipe"}" is still active. The sensor cannot take control of the servo until the pad, roller, or brush wipe reaches its CMD 3 hold. Move the object later than that wipe hold.`
    });
  }

  function turnWindow({ item, section, label, windowStart }) {
    return issue({
      code: "map-object-turn-window",
      item,
      section,
      message: `${label} does not have enough open table travel to orient before ${windowStart}°.`
    });
  }

  function exitWindow({ item, section, label }) {
    return issue({
      code: "map-object-exit-window",
      item,
      section,
      message: `${label} has no open table travel after its window to continue to the next servo reference.`
    });
  }

  function orientationCapacity({ item, section, label, rotation, span, ratio, limit }) {
    return issue({
      code: "map-object-orientation-capacity",
      item,
      section,
      message: `${label} requires ${Math.abs(rotation).toFixed(1)}° bottle rotation in ${span.toFixed(1)}° table travel (${ratio.toFixed(2)}:1; limit ${limit.toFixed(1)}:1).`
    });
  }


  const api = Object.freeze({
    issue,
    labelInactive,
    beforeApplication,
    noReference,
    windowOverlap,
    physicalWipeOverlap,
    turnWindow,
    exitWindow,
    orientationCapacity,
  });

  global.LabelerOrientationIssueFactoryDriver = api;
  global.LabelerDriverRegistry?.register("profile.orientationIssueFactory", api, {
    dependencies: ["profile.mapObjectOrientation"],
    source: "drivers/profile/orientation-issue-factory-driver.js",
    replace: true
  });

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
