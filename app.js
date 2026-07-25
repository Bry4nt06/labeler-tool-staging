"use strict";

// The mechanical map uses one fixed table reference regardless of machine flow:
// 0 degrees is 12 o'clock, 90 is 3 o'clock, 180 is 6 o'clock, and 270 is
// 9 o'clock. Machine direction controls process flow and servo sign; it must not
// mirror the physical map or move configured objects to the opposite quadrant.
function mechanicalDisplayAngle(angle) {
  return norm(num(angle, 0) - 90);
}

function angleToXY(angle, radius) {
  const rad = mechanicalDisplayAngle(angle) * Math.PI / 180;
  return {
    x: Math.cos(rad) * radius,
    y: Math.sin(rad) * radius
  };
}

function angleToSvgRotation(angle) {
  return mechanicalDisplayAngle(angle);
}

function arcPath(startAngle, endAngle, innerRadius, outerRadius) {
  const startOuter = angleToXY(startAngle, outerRadius);
  const endOuter = angleToXY(endAngle, outerRadius);
  const startInner = angleToXY(startAngle, innerRadius);
  const endInner = angleToXY(endAngle, innerRadius);
  const span = Math.min(359.999, Math.abs(num(endAngle, 0) - num(startAngle, 0)));
  const largeArc = span > 180 ? 1 : 0;
  const increasing = num(endAngle, 0) >= num(startAngle, 0);
  const sweepOuter = increasing ? 1 : 0;
  const sweepInner = sweepOuter ? 0 : 1;
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} ${sweepOuter} ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} ${sweepInner} ${startInner.x} ${startInner.y}`,
    "Z"
  ].join(" ");
}

// Keep the program visualization close to the bottle path. The previous overlay
// extended deep into the table and looked like a large inverted bottle sweep.
function drawAllProgramMovesOverlay(add, parent, program = currentProgram()) {
  if (!state.showAllProgramMovesOverlay) return;
  const moves = programSegments(program).filter((row) =>
    row.isMotionCommand
    && Number.isFinite(row.tableAngle)
    && Number.isFinite(row.tableTravel)
    && row.tableTravel !== 0
  );
  const innerRadius = Math.max(52, state.radius - 44);
  const outerRadius = Math.max(innerRadius + 18, state.radius - 18);

  moves.forEach((move, index) => {
    const startAngle = move.tableAngle;
    const endAngle = move.tableAngle + move.tableTravel;
    const positiveTurn = Number(move.plateTravel) > 0;
    const negativeTurn = Number(move.plateTravel) < 0;
    const color = move.moveFault ? "#d71920" : positiveTurn ? "#22b980" : negativeTurn ? "#e59a36" : "#5b8eae";
    const fullDescription = String(move.action || "Servo move").trim();
    const moveShape = add("path", {
      d: arcPath(startAngle, endAngle, innerRadius, outerRadius),
      fill: color,
      "fill-opacity": index % 2 ? 0.2 : 0.28,
      stroke: "none",
      "data-program-move-hmi": move.hmi
    }, parent);
    add("title", {}, moveShape).textContent = `HMI ${move.hmi}: ${fullDescription}`;

    const labelRadius = (innerRadius + outerRadius) / 2;
    const labelAngle = startAngle + move.tableTravel / 2;
    const label = angleToXY(labelAngle, labelRadius);
    let labelRotation = angleToSvgRotation(labelAngle);
    if (labelRotation > 90 && labelRotation < 270) labelRotation = norm(labelRotation + 180);
    add("text", {
      x: label.x,
      y: label.y + 2,
      fill: "#eefcff",
      "font-size": 5.5,
      "font-weight": 650,
      "text-anchor": "middle",
      transform: `rotate(${labelRotation} ${label.x} ${label.y})`,
      "pointer-events": "none"
    }, parent).textContent = fullDescription;

    const marker = angleToXY(startAngle, innerRadius + 6);
    add("text", {
      x: marker.x,
      y: marker.y + 1.5,
      fill: color,
      "font-size": 4.5,
      "font-weight": 800,
      "text-anchor": "middle",
      stroke: "#07151d",
      "stroke-width": 0.7,
      "paint-order": "stroke",
      "aria-label": `HMI ${move.hmi}`
    }, parent).textContent = String(move.hmi);
  });
}

initializeLabelerApp();
