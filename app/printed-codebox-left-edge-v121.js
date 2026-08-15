"use strict";

(function installPrintedCodeBoxLeftEdgeV121(global) {
  const BUILD_ID = "printed-codebox-left-edge-v121-20260814-2345";
  if (global.ServoForgePrintedCodeBoxLeftEdgeV121?.buildId === BUILD_ID) return;

  function finite(value, fallback = NaN) {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function activeCodingSection() {
    try {
      if (typeof selectedLabelApplicationState !== "function") return "none";
      const applications = selectedLabelApplicationState();
      if (applications?.back) return "back";
      if (applications?.body) return "body";
      if (applications?.neck) return "neck";
    } catch {
      return "none";
    }
    return "none";
  }

  function selectedLabel() {
    try {
      if (typeof selectedLabelSpec === "function") return selectedLabelSpec();
    } catch {
      // Fall through to state.
    }
    try {
      return Array.isArray(state?.labelSpecs)
        ? state.labelSpecs.find((spec) => spec?.brand === state.selectedBrand) || null
        : null;
    } catch {
      return null;
    }
  }

  function selectedBottle() {
    try {
      if (typeof selectedBottleSpec === "function") return selectedBottleSpec();
    } catch {
      // Fall through to state.
    }
    try {
      return Array.isArray(state?.bottleSpecs)
        ? state.bottleSpecs.find((spec) => spec?.bottleType === state.selectedBottle) || null
        : null;
    } catch {
      return null;
    }
  }

  function sectionLabelLengthMm(section, label) {
    if (section === "neck") return finite(label?.neckLengthMm, NaN);
    if (section === "body") return finite(label?.bodyLengthMm, NaN);
    if (section === "back") return finite(label?.backLengthMm, NaN);
    return NaN;
  }

  function sectionCircumferenceMm(section, label, bottle) {
    if (section === "neck") return finite(label?.neckBottomCircumferenceMm, NaN);
    try {
      if (typeof bodyCircumference === "function") return finite(bodyCircumference(bottle), NaN);
    } catch {
      // Use the label-width proportional fallback below.
    }
    return NaN;
  }

  function degreesFromMm(mm, circumferenceMm) {
    try {
      if (typeof degFromMm === "function") {
        const converted = finite(degFromMm(mm, circumferenceMm), NaN);
        if (Number.isFinite(converted)) return converted;
      }
    } catch {
      // Use direct circumference conversion below.
    }
    if (!Number.isFinite(circumferenceMm) || circumferenceMm <= 0) return NaN;
    return finite(mm, NaN) / circumferenceMm * 360;
  }

  function activeArtworkGeometry() {
    const section = activeCodingSection();
    if (section === "none") return null;
    const label = selectedLabel();
    const bottle = selectedBottle();
    const codeBoxCenterMm = Math.abs(finite(label?.codeBoxCenterMm, NaN));
    const labelLengthMm = sectionLabelLengthMm(section, label);
    const circumferenceMm = sectionCircumferenceMm(section, label, bottle);
    let labelWidthDeg = degreesFromMm(labelLengthMm, circumferenceMm);
    let codeBoxOffsetDeg = degreesFromMm(codeBoxCenterMm, circumferenceMm);

    // Rendering can still use the same artwork relation if circumference is not
    // yet available but the label band has already been planned.
    if (!Number.isFinite(labelWidthDeg) && typeof global.bottleLabelArcWidthDeg === "function") {
      labelWidthDeg = finite(global.bottleLabelArcWidthDeg(section), NaN);
    }
    if (!Number.isFinite(codeBoxOffsetDeg)
      && Number.isFinite(labelWidthDeg)
      && Number.isFinite(labelLengthMm)
      && labelLengthMm > 0
      && Number.isFinite(codeBoxCenterMm)) {
      codeBoxOffsetDeg = codeBoxCenterMm / labelLengthMm * labelWidthDeg;
    }

    const driver = global.LabelerCoderOrientationDriver;
    if (!driver?.printedLabelLeftEdgeLocalAngle || !driver?.printedCodeBoxLocalAngle) return null;
    if (![labelWidthDeg, codeBoxOffsetDeg, codeBoxCenterMm].every(Number.isFinite)) return null;

    const leftEdgeAngle = driver.printedLabelLeftEdgeLocalAngle({ section, labelWidthDeg });
    const codeBoxAngle = driver.printedCodeBoxLocalAngle({
      section,
      labelWidthDeg,
      codeBoxOffsetDeg,
      inspectionOffsetDeg: 0
    });
    if (![leftEdgeAngle, codeBoxAngle].every(Number.isFinite)) return null;

    return {
      section,
      codeBoxCenterMm,
      labelLengthMm,
      circumferenceMm,
      labelWidthDeg,
      codeBoxOffsetDeg,
      leftEdgeAngle,
      codeBoxAngle
    };
  }

  function point(angle, radius) {
    const radians = Number(angle) * Math.PI / 180;
    return {
      x: Math.cos(radians) * radius,
      y: Math.sin(radians) * radius
    };
  }

  function labelVisibleAt(section, tableAngle) {
    try {
      const application = typeof global.bottleLabelApplications === "function"
        ? global.bottleLabelApplications().find((entry) => entry?.section === section)
        : null;
      if (!application) return true;
      return typeof global.bottleHasPassedApplication === "function"
        ? global.bottleHasPassedApplication(tableAngle, application.angle)
        : true;
    } catch {
      return true;
    }
  }

  function drawArtworkTicks(add, bottleGroup, tableAngle) {
    const geometry = activeArtworkGeometry();
    if (!geometry) return;
    const visual = global.LabelerBottleVisualRenderer?.indicators?.[geometry.section];
    if (!visual) return;

    const visible = labelVisibleAt(geometry.section, tableAngle) ? "inline" : "none";
    const leftInner = point(geometry.leftEdgeAngle, visual.innerRadius - 0.25);
    const leftOuter = point(geometry.leftEdgeAngle, visual.outerRadius + 0.9);
    add("line", {
      x1: leftInner.x,
      y1: leftInner.y,
      x2: leftOuter.x,
      y2: leftOuter.y,
      stroke: "#76f06a",
      "stroke-width": 0.7,
      "stroke-linecap": "round",
      "data-bottle-label-left-edge": geometry.section,
      "data-label-left-edge-angle": geometry.leftEdgeAngle,
      display: visible,
      "pointer-events": "none"
    }, bottleGroup);

    const codeInner = point(geometry.codeBoxAngle, visual.innerRadius - 0.4);
    const codeOuter = point(geometry.codeBoxAngle, visual.outerRadius + 1.15);
    add("line", {
      x1: codeInner.x,
      y1: codeInner.y,
      x2: codeOuter.x,
      y2: codeOuter.y,
      stroke: "#ffd166",
      "stroke-width": 0.95,
      "stroke-linecap": "round",
      "data-bottle-code-box-center": geometry.section,
      "data-code-box-center-mm": geometry.codeBoxCenterMm,
      "data-code-box-local-angle": geometry.codeBoxAngle,
      display: visible,
      "pointer-events": "none"
    }, bottleGroup);
  }

  function installRendererHook() {
    const base = global.drawTopViewBottle;
    if (typeof base !== "function") return false;
    if (base.printedCodeBoxLeftEdgeV121 === true) return true;

    const wrapped = function drawTopViewBottleWithPrintedCodeBoxV121(add, bottleGroup, tableAngle, ...args) {
      const result = base.call(this, add, bottleGroup, tableAngle, ...args);
      drawArtworkTicks(add, bottleGroup, tableAngle);
      return result;
    };
    wrapped.printedCodeBoxLeftEdgeV121 = true;
    wrapped.previousDrawTopViewBottle = base;
    global.drawTopViewBottle = wrapped;
    return true;
  }

  if (!installRendererHook()) {
    throw new Error("Printed code-box visual v121 loaded before the shared bottle renderer.");
  }

  global.ServoForgePrintedCodeBoxLeftEdgeV121 = Object.freeze({
    installed: true,
    buildId: BUILD_ID,
    activeCodingSection,
    activeArtworkGeometry,
    drawArtworkTicks,
    operatorFacingLeftEdge: true,
    printedArtworkDirectionInvariant: true
  });
})(typeof window !== "undefined" ? window : globalThis);
