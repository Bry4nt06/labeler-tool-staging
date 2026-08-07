"use strict";

(function installBottleVisualRenderer(global) {
  // The scene renderers own the outer 7.5-unit bottle footprint and the final
  // red datum/cap mark. These dimensions add the concentric features that make
  // the symbol read as a bottle viewed vertically from above.
  const BOTTLE_GEOMETRY = Object.freeze({
    bodyRadius: 7.5,
    shoulderRadius: 5.55,
    neckRadius: 3.25,
    capRadius: 2.2
  });

  const INDICATORS = Object.freeze({
    // Neck and Body share the front datum, so they use the same angular center.
    // Separate radial bands keep both labels readable in a true top view.
    neck: Object.freeze({ center: 0, innerRadius: 4.05, outerRadius: 5.15, color: "#f0c84b" }),
    body: Object.freeze({ center: 0, innerRadius: 6.0, outerRadius: 7.25, color: "#42c987" }),
    back: Object.freeze({ center: 180, innerRadius: 6.0, outerRadius: 7.25, color: "#a984e8" })
  });

  function bottleLocalArcPath(startAngle, endAngle, innerRadius, outerRadius) {
    const point = (angle, radius) => {
      const radians = angle * Math.PI / 180;
      return { x: Math.cos(radians) * radius, y: Math.sin(radians) * radius };
    };
    const startOuter = point(startAngle, outerRadius);
    const endOuter = point(endAngle, outerRadius);
    const startInner = point(startAngle, innerRadius);
    const endInner = point(endAngle, innerRadius);
    const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    return [
      `M ${startOuter.x} ${startOuter.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
      `L ${endInner.x} ${endInner.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
      "Z"
    ].join(" ");
  }

  function bottleLabelApplications() {
    const available = typeof selectedLabelApplicationState === "function"
      ? selectedLabelApplicationState()
      : { neck: true, body: true, back: true };
    const applications = [];
    const seen = new Set();
    activeAggregateDefinitions()
      .sort((left, right) => norm(left.angle) - norm(right.angle))
      .forEach((aggregate) => {
        const section = labelSectionForStation(aggregate.number);
        if (!INDICATORS[section] || !available[section] || seen.has(section)) return;
        seen.add(section);
        applications.push({ section, station: aggregate.number, angle: norm(aggregate.angle) });
      });
    return applications;
  }

  function bottleHasPassedApplication(tableAngle, applicationAngle) {
    return norm(tableAngle) + 0.001 >= norm(applicationAngle);
  }

  function bottlePreviewAngle(head, program = currentProgram()) {
    if (head?.head === 1 && state.previewBottleAngle !== null && state.previewBottleAngle !== "" && Number.isFinite(Number(state.previewBottleAngle))) {
      return Number(state.previewBottleAngle);
    }
    return plateAngleAt(head?.tableAngle, program);
  }

  function drawTopViewBottleStructure(add, bottleGroup) {
    // Shoulder ring: the visible transition from the bottle body to the neck.
    add("circle", {
      cx: 0,
      cy: 0,
      r: BOTTLE_GEOMETRY.shoulderRadius,
      fill: "var(--map-surface)",
      "fill-opacity": 0.82,
      stroke: "var(--map-ring)",
      "stroke-width": 0.75,
      "stroke-opacity": 0.92,
      "data-bottle-top-view-shoulder": "true"
    }, bottleGroup);

    // Neck ring. The scene renderer's existing center circle becomes the cap,
    // so together these concentric circles read like a bottle mouth from above.
    add("circle", {
      cx: 0,
      cy: 0,
      r: BOTTLE_GEOMETRY.neckRadius,
      fill: "var(--map-head-fill)",
      stroke: "var(--map-head-stroke)",
      "stroke-width": 0.95,
      "data-bottle-top-view-neck": "true"
    }, bottleGroup);

    bottleGroup.setAttribute("data-bottle-view", "top");
  }

  function drawBottleLabelIndicators(add, bottleGroup, tableAngle) {
    // Draw the bottle's top-view structure first. Both the Mechanical Map and
    // Servo Simulation call this function, keeping their bottle visuals aligned.
    drawTopViewBottleStructure(add, bottleGroup);

    bottleLabelApplications().forEach((application) => {
      const visual = INDICATORS[application.section];
      const start = visual.center - 45;
      const end = visual.center + 45;
      add("path", {
        d: bottleLocalArcPath(start, end, visual.innerRadius, visual.outerRadius),
        fill: visual.color,
        "fill-opacity": 0.92,
        stroke: visual.color,
        "stroke-width": 0.42,
        "stroke-opacity": 0.98,
        "data-bottle-label-indicator": application.section,
        "data-application-angle": application.angle,
        "data-application-station": application.station,
        display: bottleHasPassedApplication(tableAngle, application.angle) ? "inline" : "none"
      }, bottleGroup);
    });

    // Small inner rim sits above the label bands but below the red front datum.
    add("circle", {
      cx: 0,
      cy: 0,
      r: 2.65,
      fill: "none",
      stroke: "var(--map-text)",
      "stroke-width": 0.42,
      "stroke-opacity": 0.34,
      "pointer-events": "none",
      "aria-hidden": "true"
    }, bottleGroup);
  }

  // Complete helper for any future renderer that wants to delegate the whole
  // top-view bottle to this module. Current map scenes keep their existing outer
  // circle/datum/cap drawing so animation behavior remains unchanged.
  function drawTopViewBottle(add, bottleGroup, tableAngle) {
    add("circle", {
      cx: 0,
      cy: 0,
      r: BOTTLE_GEOMETRY.bodyRadius,
      fill: "var(--map-head-fill)",
      stroke: "var(--map-head-stroke)",
      "stroke-width": 1.7,
      "data-bottle-top-view-body": "true"
    }, bottleGroup);
    drawBottleLabelIndicators(add, bottleGroup, tableAngle);
    add("line", {
      x1: 0,
      y1: 0,
      x2: 6.6,
      y2: 0,
      stroke: "#ff4d3a",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "data-bottle-orientation": "true",
      "data-bottle-front-centerline": "true"
    }, bottleGroup);
    add("circle", {
      cx: 0,
      cy: 0,
      r: BOTTLE_GEOMETRY.capRadius,
      fill: "var(--map-head-stroke)",
      stroke: "var(--map-text)",
      "stroke-width": 0.35,
      "stroke-opacity": 0.5,
      "data-bottle-top-view-cap": "true"
    }, bottleGroup);
    return bottleGroup;
  }

  global.bottleLocalArcPath = bottleLocalArcPath;
  global.bottleLabelApplications = bottleLabelApplications;
  global.bottleHasPassedApplication = bottleHasPassedApplication;
  global.bottlePreviewAngle = bottlePreviewAngle;
  global.drawBottleLabelIndicators = drawBottleLabelIndicators;
  global.drawTopViewBottle = drawTopViewBottle;
  global.LabelerBottleVisualRenderer = Object.freeze({
    indicators: INDICATORS,
    geometry: BOTTLE_GEOMETRY,
    bottleLocalArcPath,
    bottleLabelApplications,
    bottleHasPassedApplication,
    bottlePreviewAngle,
    drawTopViewBottleStructure,
    drawBottleLabelIndicators,
    drawTopViewBottle,
    topViewBottleV1: true
  });
})(window);
