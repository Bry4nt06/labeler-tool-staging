"use strict";

const fs = require("fs");

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(path, from, to, label) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`Missing ${label} in ${path}`);
  write(path, source.replace(from, to));
}

replaceOnce(
  "index.html",
  `            <label class="switch-setting" for="showAllProgramMovesOverlay">
              <span class="switch-copy"><strong>Show all program moves</strong><small>Display every servo move and its HMI line.</small></span>
              <span class="switch-control"><input id="showAllProgramMovesOverlay" type="checkbox" /><span class="switch-track" aria-hidden="true"></span></span>
            </label>
`,
  `            <label class="switch-setting" for="showAllProgramMovesOverlay">
              <span class="switch-copy"><strong>Show all program moves</strong><small>Display every servo move and its HMI line.</small></span>
              <span class="switch-control"><input id="showAllProgramMovesOverlay" type="checkbox" /><span class="switch-track" aria-hidden="true"></span></span>
            </label>
            <label class="switch-setting" for="showEntryExitDeadZoneOverlay">
              <span class="switch-copy"><strong>Show entry / exit dead zone</strong><small>Highlight the 330° → 30° bottle entry and exit region.</small></span>
              <span class="switch-control"><input id="showEntryExitDeadZoneOverlay" type="checkbox" /><span class="switch-track" aria-hidden="true"></span></span>
            </label>
`,
  "dead zone overlay switch"
);
replaceOnce(
  "index.html",
  "app/bootstrap.js?v=0.9.10-station1-bottle-orientation-v72-20260811-1600",
  "app/bootstrap.js?v=0.9.10-entry-exit-dead-zone-overlay-v73-20260811-1604",
  "v73 bootstrap cache bust"
);

replaceOnce(
  "app/defaults.js",
  `  showMoveDistanceOverlay: false,
  showAllProgramMovesOverlay: false,
  showQuadrantReferences: false,
`,
  `  showMoveDistanceOverlay: false,
  showAllProgramMovesOverlay: false,
  showEntryExitDeadZoneOverlay: false,
  showQuadrantReferences: false,
`,
  "dead zone state default"
);
replaceOnce(
  "app/defaults.js",
  `  showMoveDistanceOverlay: document.querySelector("#showMoveDistanceOverlay"),
  showAllProgramMovesOverlay: document.querySelector("#showAllProgramMovesOverlay"),
  showQuadrantReferences: document.querySelector("#showQuadrantReferences"),
`,
  `  showMoveDistanceOverlay: document.querySelector("#showMoveDistanceOverlay"),
  showAllProgramMovesOverlay: document.querySelector("#showAllProgramMovesOverlay"),
  showEntryExitDeadZoneOverlay: document.querySelector("#showEntryExitDeadZoneOverlay"),
  showQuadrantReferences: document.querySelector("#showQuadrantReferences"),
`,
  "dead zone element binding"
);

replaceOnce(
  "app/controllers/settings-controller.js",
  `  function setAggregateSpacing(enabled) {
    commit("showAggregateSpacingOverlay", Boolean(enabled), { render: "map" });
  }
`,
  `  function setEntryExitDeadZoneOverlay(enabled) {
    commit("showEntryExitDeadZoneOverlay", Boolean(enabled), {
      render: ["map", "simulation-map"]
    });
  }

  function setAggregateSpacing(enabled) {
    commit("showAggregateSpacingOverlay", Boolean(enabled), { render: "map" });
  }
`,
  "dead zone settings action"
);
replaceOnce(
  "app/controllers/settings-controller.js",
  `    setMovementOverlay,
    setAggregateSpacing,
`,
  `    setMovementOverlay,
    setEntryExitDeadZoneOverlay,
    setAggregateSpacing,
`,
  "dead zone settings export"
);

replaceOnce(
  "app/controllers/setup-event-controller-integration.js",
  `    else if (target === els.showMoveDistanceOverlay) settings.setMovementOverlay("distance", target.checked);
    else if (target === els.showAllProgramMovesOverlay) settings.setMovementOverlay("all", target.checked);
    else if (target === els.direction) map.setDirection(target.value);
`,
  `    else if (target === els.showMoveDistanceOverlay) settings.setMovementOverlay("distance", target.checked);
    else if (target === els.showAllProgramMovesOverlay) settings.setMovementOverlay("all", target.checked);
    else if (target === els.showEntryExitDeadZoneOverlay) settings.setEntryExitDeadZoneOverlay(target.checked);
    else if (target === els.direction) map.setDirection(target.value);
`,
  "dead zone change event"
);

replaceOnce(
  "app/map-overlay-renderer.js",
  `  const QUADRANT_REFERENCES = Object.freeze([90, 180, 270, 359.9]);
`,
  `  const QUADRANT_REFERENCES = Object.freeze([90, 180, 270, 359.9]);
  const ENTRY_EXIT_DEAD_ZONE = Object.freeze({ start: 330, end: 30, span: 60 });

  function deadZoneSectorPath(innerRadius, outerRadius) {
    const points = [];
    const step = 2;
    for (let angle = ENTRY_EXIT_DEAD_ZONE.start; angle <= 360 + ENTRY_EXIT_DEAD_ZONE.end; angle += step) {
      points.push(angleToXY(angle, outerRadius));
    }
    points.push(angleToXY(360 + ENTRY_EXIT_DEAD_ZONE.end, outerRadius));
    for (let angle = 360 + ENTRY_EXIT_DEAD_ZONE.end; angle >= ENTRY_EXIT_DEAD_ZONE.start; angle -= step) {
      points.push(angleToXY(angle, innerRadius));
    }
    points.push(angleToXY(ENTRY_EXIT_DEAD_ZONE.start, innerRadius));
    return points.map((point, index) => \`${"${index ? \"L\" : \"M\"}"} ${"${point.x}"} ${"${point.y}"}\`).join(" ") + " Z";
  }

  function drawEntryExitDeadZoneOverlay(add, parent) {
    if (!state.showEntryExitDeadZoneOverlay) return;
    const innerRadius = 45;
    const outerRadius = Math.max(innerRadius + 10, Number(state.radius || 0) + 9);
    add("path", {
      d: deadZoneSectorPath(innerRadius, outerRadius),
      fill: "#6e087f",
      "fill-opacity": 0.30,
      stroke: "#9e279c",
      "stroke-width": 1.2,
      "stroke-opacity": 0.56,
      "pointer-events": "none",
      "data-entry-exit-dead-zone": "330-30",
      "aria-label": "Bottle entry and exit dead zone from 330 to 30 degrees"
    }, parent);

    [ENTRY_EXIT_DEAD_ZONE.start, ENTRY_EXIT_DEAD_ZONE.end].forEach((angle) => {
      const inner = angleToXY(angle, innerRadius);
      const outer = angleToXY(angle, outerRadius);
      add("line", {
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        stroke: "#d63163",
        "stroke-width": 2,
        "stroke-opacity": 0.78,
        "stroke-dasharray": "7 5",
        "vector-effect": "non-scaling-stroke",
        "pointer-events": "none",
        "data-dead-zone-boundary": angle
      }, parent);
    });

    const labelPoint = angleToXY(0, Math.max(innerRadius + 24, outerRadius * 0.63));
    add("text", {
      x: labelPoint.x,
      y: labelPoint.y,
      fill: "#df8fe8",
      "font-size": 8,
      "font-weight": 800,
      "letter-spacing": 0.5,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      stroke: "var(--map-surface)",
      "stroke-width": 2.5,
      "paint-order": "stroke fill",
      "pointer-events": "none",
      "data-dead-zone-label": "330-30"
    }, parent).textContent = "ENTRY / EXIT DEAD ZONE";
  }
`,
  "dead zone renderer"
);
replaceOnce(
  "app/map-overlay-renderer.js",
  `  global.drawMapQuadrantReferences = drawMapQuadrantReferences;
  global.drawAggregateSpacingOverlay = drawAggregateSpacingOverlay;
  global.LabelerMapOverlayRenderer = Object.freeze({
    quadrantReferences: QUADRANT_REFERENCES,
    drawMapQuadrantReferences,
    drawAggregateSpacingOverlay
  });
`,
  `  global.drawMapQuadrantReferences = drawMapQuadrantReferences;
  global.drawEntryExitDeadZoneOverlay = drawEntryExitDeadZoneOverlay;
  global.drawAggregateSpacingOverlay = drawAggregateSpacingOverlay;
  global.LabelerMapOverlayRenderer = Object.freeze({
    quadrantReferences: QUADRANT_REFERENCES,
    entryExitDeadZone: ENTRY_EXIT_DEAD_ZONE,
    deadZoneSectorPath,
    drawMapQuadrantReferences,
    drawEntryExitDeadZoneOverlay,
    drawAggregateSpacingOverlay
  });
`,
  "dead zone renderer export"
);

for (const file of ["app/mechanical-map-scene-renderer.js", "app/simulation-map-scene-renderer.js"]) {
  replaceOnce(
    file,
    `    const bottleHeads = heads();
    drawBottleTableVisual(add, svg, state.radius, bottleHeads);
    const quadrantLayer = add("g", { "aria-label": "Table quadrant references" });
`,
    `    const bottleHeads = heads();
    drawBottleTableVisual(add, svg, state.radius, bottleHeads);
    const deadZoneLayer = add("g", { "aria-label": "Bottle entry and exit dead zone", "data-entry-exit-dead-zone-layer": "true" });
    drawEntryExitDeadZoneOverlay(add, deadZoneLayer);
    const quadrantLayer = add("g", { "aria-label": "Table quadrant references" });
`,
    `${file} dead zone layer`
  );
}

let bootstrap = read("app/bootstrap.js");
bootstrap = bootstrap.replace(/const build = "[^"]+";/, 'const build = "entry-exit-dead-zone-overlay-v73-20260811-1604";');
bootstrap = bootstrap.replace(/const buildUpdatedAt = "[^"]+";/, 'const buildUpdatedAt = "Aug 11, 2026 4:04 PM ET";');
bootstrap = bootstrap.replace("// Regression lineage:", "// Regression lineage: entry-exit-dead-zone-overlay-v73-20260811-1604 •");
write("app/bootstrap.js", bootstrap);

write("update-manifest.json", JSON.stringify({
  schemaVersion: 1,
  version: "0.9.10",
  buildId: "entry-exit-dead-zone-overlay-v73-20260811-1604",
  releaseUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  downloadUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  notes: "Staging v73 adds an independent Entry / Exit Dead Zone overlay covering 330° through 0° to 30°. It can remain visible at the same time as either Active Move Distance or All Program Moves, and is rendered beneath the motion overlays on both the mechanical map and simulation map."
}, null, 2) + "\n");

write("tests/entry-exit-dead-zone-overlay.test.js", `"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
global.window = global;
global.state = { radius: 250, showEntryExitDeadZoneOverlay: false, showMoveDistanceOverlay: false, showAllProgramMovesOverlay: false };
global.angleToXY = (angle, radius) => { const r = Number(angle) * Math.PI / 180; return { x: Math.cos(r) * radius, y: Math.sin(r) * radius }; };
global.fmt = (value) => String(value);
const overlayPath = path.join(root, "app/map-overlay-renderer.js");
delete require.cache[require.resolve(overlayPath)];
require(overlayPath);
assert.deepStrictEqual(global.LabelerMapOverlayRenderer.entryExitDeadZone, { start: 330, end: 30, span: 60 });
function collect() { const nodes = []; const add = (name, attrs) => { const node = { name, attrs, textContent: "" }; nodes.push(node); return node; }; global.drawEntryExitDeadZoneOverlay(add, {}); return nodes; }
assert.equal(collect().length, 0);
state.showEntryExitDeadZoneOverlay = true;
let nodes = collect();
assert(nodes.some((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30"));
assert.deepStrictEqual(nodes.filter((n) => n.attrs["data-dead-zone-boundary"] !== undefined).map((n) => Number(n.attrs["data-dead-zone-boundary"])), [330, 30]);
state.showMoveDistanceOverlay = true; state.showAllProgramMovesOverlay = true;
nodes = collect();
assert(nodes.some((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30"), "dead zone must remain active with other overlays");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.match(index, /id="showEntryExitDeadZoneOverlay"/); assert.match(index, /330° → 30°/); assert.match(index, /entry-exit-dead-zone-overlay-v73-20260811-1604/);
const settings = fs.readFileSync(path.join(root, "app/controllers/settings-controller.js"), "utf8");
assert.match(settings, /function setEntryExitDeadZoneOverlay/); assert.match(settings, /commit\\("showEntryExitDeadZoneOverlay"/);
for (const relative of ["app/mechanical-map-scene-renderer.js", "app/simulation-map-scene-renderer.js"]) { const source = fs.readFileSync(path.join(root, relative), "utf8"); assert.match(source, /drawEntryExitDeadZoneOverlay\\(add, deadZoneLayer\\)/); assert(source.indexOf("drawEntryExitDeadZoneOverlay(add, deadZoneLayer)") < source.indexOf("drawMoveDistanceOverlay")); }
console.log("Entry / exit dead zone overlay v73 regression passed.");
`);

console.log("Applied ServoForge entry/exit dead zone overlay v73 patch.");
