"use strict";

(function installBottleVisualRenderer(global) {
  const BOTTLE_GEOMETRY = Object.freeze({
    bodyRadius: 8.4,
    shoulderRadius: 6.15,
    neckRadius: 3.35,
    capRadius: 1.75,
    centerlineLength: 8.65
  });

  const INDICATORS = Object.freeze({
    // Neck and Body share the front datum, so they use the same angular center.
    // Separate radial bands keep both labels readable in a true top view.
    neck: Object.freeze({ center: 0, innerRadius: 4.35, outerRadius: 5.55, color: "#f0c84b" }),
    body: Object.freeze({ center: 0, innerRadius: 6.45, outerRadius: 8.05, color: "#42c987" }),
    back: Object.freeze({ center: 180, innerRadius: 6.45, outerRadius: 8.05, color: "#a984e8" })
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

  function drawBottleLabelIndicators(add, bottleGroup, tableAngle) {
    bottleLabelApplications().forEach((application) => {
      const visual = INDICATORS[application.section];
      const start = visual.center - 45;
      const end = visual.center + 45;
      add("path", {
        d: bottleLocalArcPath(start, end, visual.innerRadius, visual.outerRadius),
        fill: visual.color,
        "fill-opacity": 0.92,
        stroke: visual.color,
        "stroke-width": 0.45,
        "stroke-opacity": 0.98,
        "data-bottle-label-indicator": application.section,
        "data-application-angle": application.angle,
        "data-application-station": application.station,
        display: bottleHasPassedApplication(tableAngle, application.angle) ? "inline" : "none"
      }, bottleGroup);
    });
  }

  function drawTopViewBottle(add, bottleGroup, tableAngle) {
    const geometry = BOTTLE_GEOMETRY;

    // Outer glass/body footprint. Concentric shoulder/neck/cap rings make the
    // symbol unmistakably a bottle viewed vertically from above rather than a
    // side-view bottle laying on the carousel.
    add("circle", {
      cx: 0,
      cy: 0,
      r: geometry.bodyRadius + 0.65,
      fill: "#000000",
      "fill-opacity": 0.2,
      stroke: "none",
      "data-bottle-top-view-shadow": "true"
    }, bottleGroup);
    add("circle", {
      cx: 0,
      cy: 0,
      r: geometry.bodyRadius,
      fill: "var(--map-head-fill)",
      stroke: "var(--map-head-stroke)",
      "stroke-width": 1.45,
      "data-bottle-top-view-body": "true"
    }, bottleGroup);
    add("circle", {
      cx: 0,
      cy: 0,
      r: geometry.shoulderRadius,
      fill: "var(--map-surface)",
      "fill-opacity": 0.86,
      stroke: "var(--map-ring)",
      "stroke-width": 0.8,
      "stroke-opacity": 0.9,
      "data-bottle-top-view-shoulder": "true"
    }, bottleGroup);

    // Label wraps are rendered between the bottle wall and the neck/cap so the
    // operator can see Neck + Body on the shared front datum and Back opposite.
    drawBottleLabelIndicators(add, bottleGroup, tableAngle);

    // Red line is the bottle/front datum used throughout ServoForge. The whole
    // bottle group rotates with the servo plate, so this remains a true physical
    // orientation reference during animation.
    add("line", {
      x1: 0,
      y1: 0,
      x2: geometry.centerlineLength,
      y2: 0,
      stroke: "#ff4d3a",
      "stroke-width": 1.7,
      "stroke-linecap": "round",
      "data-bottle-orientation": "true",
      "data-bottle-front-centerline": "true"
    }, bottleGroup);

    add("circle", {
      cx: 0,
      cy: 0,
      r: geometry.neckRadius,
      fill: "var(--map-head-fill)",
      stroke: "var(--map-head-stroke)",
      "stroke-width": 1.05,
      "data-bottle-top-view-neck": "true"
    }, bottleGroup);
    add("circle", {
      cx: 0,
      cy: 0,
      r: geometry.capRadius,
      fill: "var(--map-head-stroke)",
      "fill-opacity": 0.78,
      stroke: "var(--map-text)",
      "stroke-width": 0.45,
      "stroke-opacity": 0.62,
      "data-bottle-top-view-cap": "true"
    }, bottleGroup);
    add("circle", {
      cx: -0.55,
      cy: -0.6,
      r: 0.55,
      fill: "#ffffff",
      "fill-opacity": 0.34,
      stroke: "none",
      "pointer-events": "none",
      "aria-hidden": "true"
    }, bottleGroup);

    bottleGroup.setAttribute("data-bottle-view", "top");
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
    drawBottleLabelIndicators,
    drawTopViewBottle,
    topViewBottleV1: true
  });
})(window);
