"use strict";

const fs = require("fs");

const BUILD = "map-layout-dead-zone-bottle-visual-v75-20260811-1628";
const UPDATED = "Aug 11, 2026 4:28 PM ET";
const PREVIOUS_BUILD = "client-delivery-refresh-v74-20260811-1612";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing ${label}`);
  return content.replace(from, to);
}

// 1. Refine the 330° -> 30° dead zone: light red, stop at the same
// operational overlay radius, and offset the text slightly above the 0° line.
let overlay = read("app/map-overlay-renderer.js");
overlay = replaceOnce(
  overlay,
  'const outerRadius = Math.max(innerRadius + 10, Number(state.radius || 0) + 9);',
  'const outerRadius = Math.max(innerRadius + 10, Number(state.radius || 0) - 24);',
  "dead-zone outer radius"
);
overlay = replaceOnce(overlay, 'fill: "#6e087f",', 'fill: "#ef737a",', "dead-zone fill");
overlay = replaceOnce(overlay, '"fill-opacity": 0.30,', '"fill-opacity": 0.22,', "dead-zone fill opacity");
overlay = replaceOnce(overlay, 'stroke: "#9e279c",', 'stroke: "#ff9aa0",', "dead-zone outline");
overlay = replaceOnce(overlay, '"stroke-opacity": 0.56,', '"stroke-opacity": 0.70,', "dead-zone outline opacity");
overlay = replaceOnce(overlay, 'stroke: "#d63163",', 'stroke: "#ff7078",', "dead-zone boundary");
overlay = replaceOnce(
  overlay,
  'y: labelPoint.y,\n      fill: "#df8fe8",',
  'y: labelPoint.y - 9,\n      fill: "#ffd1d4",',
  "dead-zone foreground label"
);
write("app/map-overlay-renderer.js", overlay);

// 2. Move only the label to the foreground after the operational/equipment
// layers are drawn. The translucent sector itself remains below other overlays.
for (const path of ["app/mechanical-map-scene-renderer.js", "app/simulation-map-scene-renderer.js"]) {
  let source = read(path);
  source = replaceOnce(
    source,
    '    const centerReadout = add("g", { "aria-label": "Current table angle" });',
    '    const deadZoneLabel = deadZoneLayer.querySelector?.("[data-dead-zone-label]");\n    if (deadZoneLabel) svg.appendChild(deadZoneLabel);\n\n    const centerReadout = add("g", { "aria-label": "Current table angle" });',
    `${path} dead-zone foreground label`
  );
  write(path, source);
}

// 3. Compact the map in Direct view and physically relocate Map Overlays and
// Label Wipe-Down beneath the map while preserving their existing DOM nodes and listeners.
write("app/map-workspace-compact-support-integration.js", `"use strict";\n\n(function installMapWorkspaceCompactSupport(global) {\n  if (global.ServoForgeMapWorkspaceCompactSupport?.installed) return;\n\n  const STYLE_ID = "servoforge-map-workspace-compact-support-v75";\n  const SUPPORT_CLASS = "map-support-panels";\n\n  function ensureStyles() {\n    if (document.getElementById(STYLE_ID)) return;\n    const style = document.createElement("style");\n    style.id = STYLE_ID;\n    style.textContent = \`\n      .map-area.servoforge-compact-map-panel {\n        min-height: 0;\n        height: auto;\n        align-self: start;\n        grid-template-rows: auto auto auto;\n      }\n      .map-area.servoforge-compact-map-panel .map-stage {\n        height: clamp(400px, 52vh, 520px);\n        min-height: 400px;\n      }\n      .map-area.servoforge-compact-map-panel .map-canvas,\n      .map-area.servoforge-compact-map-panel #mapSvg {\n        height: 100%;\n        min-height: 400px;\n      }\n      .map-support-panels {\n        display: grid;\n        grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr);\n        gap: 10px;\n        align-items: start;\n        margin-top: 10px;\n      }\n      .map-support-panels > .panel {\n        min-width: 0;\n        width: 100%;\n        margin: 0;\n        box-shadow: none;\n      }\n      .map-support-panels > .map-overlay-control {\n        padding: 10px;\n      }\n      .map-support-panels > .wipe-down-data-panel {\n        position: static;\n        inset: auto;\n        max-width: none;\n        max-height: none;\n      }\n      .map-support-panels:has(.wipe-down-data-panel[hidden]) > .map-overlay-control {\n        grid-column: 1 / -1;\n      }\n      @media (min-width: 1250px) {\n        .workspace-view-direct .map-area.servoforge-compact-map-panel .map-stage {\n          height: clamp(400px, 48vh, 480px);\n          min-height: 400px;\n        }\n        .workspace-view-direct .map-area.servoforge-compact-map-panel .map-canvas,\n        .workspace-view-direct .map-area.servoforge-compact-map-panel #mapSvg {\n          min-height: 400px;\n        }\n      }\n      @media (max-width: 760px) {\n        .map-support-panels { grid-template-columns: 1fr; }\n        .map-support-panels > .map-overlay-control { grid-column: auto; }\n      }\n    \`;\n    document.head.appendChild(style);\n  }\n\n  function installLayout() {\n    ensureStyles();\n    const mapArea = document.querySelector(".map-area");\n    const mapStage = mapArea?.querySelector(".map-stage");\n    const overlays = document.querySelector(".map-overlay-control");\n    const wipeDown = document.querySelector("#wipeDownDataPanel");\n    if (!mapArea || !mapStage || !overlays || !wipeDown) return false;\n\n    mapArea.classList.add("servoforge-compact-map-panel");\n    let support = mapArea.querySelector(\`.\${SUPPORT_CLASS}\`);\n    if (!support) {\n      support = document.createElement("section");\n      support.className = SUPPORT_CLASS;\n      support.setAttribute("aria-label", "Mechanical map support panels");\n      mapStage.insertAdjacentElement("afterend", support);\n    }\n    if (overlays.parentElement !== support) support.appendChild(overlays);\n    if (wipeDown.parentElement !== support) support.appendChild(wipeDown);\n    return true;\n  }\n\n  function installWhenReady() {\n    if (installLayout()) return;\n    let attempts = 0;\n    const timer = global.setInterval(() => {\n      attempts += 1;\n      if (installLayout() || attempts >= 40) global.clearInterval(timer);\n    }, 100);\n  }\n\n  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installWhenReady, { once: true });\n  else installWhenReady();\n  global.addEventListener("load", installLayout, { once: true });\n\n  global.ServoForgeMapWorkspaceCompactSupport = Object.freeze({\n    installed: true,\n    version: 1,\n    installLayout,\n    supportPanelsBelowMapV75: true,\n    directMapHeightCappedV75: true\n  });\n})(typeof window !== "undefined" ? window : globalThis);\n`);

// 4. Guarantee the v72 Bottle Orientation panel survives any later table renderer
// that replaces #program/#simulation children. The existing visual remains authoritative.
write("app/bottle-orientation-panel-recovery-integration.js", `"use strict";\n\n(function installBottleOrientationPanelRecovery(global) {\n  if (global.ServoForgeBottleOrientationPanelRecovery?.installed) return;\n\n  const sources = ["program", "simulation"];\n  const observers = new Map();\n  let recoveryQueued = false;\n\n  function api() { return global.LabelerBottleOrientationPanel || null; }\n\n  function recoverSource(source) {\n    const visual = api();\n    const host = document.getElementById(source);\n    if (!visual?.renderSource || !host) return false;\n    if (!host.querySelector(\`[data-bottle-orientation-panel="\${source}"]\`)) {\n      visual.renderSource(source);\n    }\n    return Boolean(host.querySelector(\`[data-bottle-orientation-panel="\${source}"]\`));\n  }\n\n  function recoverAll() {\n    recoveryQueued = false;\n    sources.forEach(recoverSource);\n  }\n\n  function queueRecovery() {\n    if (recoveryQueued) return;\n    recoveryQueued = true;\n    global.requestAnimationFrame ? global.requestAnimationFrame(recoverAll) : global.setTimeout(recoverAll, 0);\n  }\n\n  function observeHost(source) {\n    const host = document.getElementById(source);\n    if (!host || observers.has(source) || typeof MutationObserver !== "function") return false;\n    const observer = new MutationObserver(() => {\n      if (!host.querySelector(\`[data-bottle-orientation-panel="\${source}"]\`)) queueRecovery();\n    });\n    observer.observe(host, { childList: true });\n    observers.set(source, observer);\n    return true;\n  }\n\n  function install() {\n    sources.forEach(observeHost);\n    recoverAll();\n    global.setTimeout(recoverAll, 150);\n    global.setTimeout(recoverAll, 750);\n    global.setTimeout(recoverAll, 1800);\n  }\n\n  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });\n  else install();\n  global.addEventListener("load", recoverAll, { once: true });\n\n  global.ServoForgeBottleOrientationPanelRecovery = Object.freeze({\n    installed: true,\n    version: 1,\n    recoverSource,\n    recoverAll,\n    servoProgramPanelGuaranteedV75: true\n  });\n})(typeof window !== "undefined" ? window : globalThis);\n`);

// 5. Load the presentation integrations in the bootstrap pipeline and advance the build.
let bootstrap = read("app/bootstrap.js");
bootstrap = replaceOnce(bootstrap, `const build = "${PREVIOUS_BUILD}";`, `const build = "${BUILD}";`, "bootstrap build");
bootstrap = replaceOnce(bootstrap, 'const buildUpdatedAt = "Aug 11, 2026 4:12 PM ET";', `const buildUpdatedAt = "${UPDATED}";`, "bootstrap timestamp");
bootstrap = replaceOnce(bootstrap, '// Regression lineage: client-delivery-refresh-v74-20260811-1612', `// Regression lineage: ${BUILD} • client-delivery-refresh-v74-20260811-1612`, "bootstrap lineage");
bootstrap = replaceOnce(
  bootstrap,
  '    "app/compact-layout-defaults-wipe-orientation-integration.js",',
  '    "app/compact-layout-defaults-wipe-orientation-integration.js",\n    "app/map-workspace-compact-support-integration.js",',
  "compact map module"
);
bootstrap = replaceOnce(
  bootstrap,
  '    "app/bottle-orientation-panel-integration.js",',
  '    "app/bottle-orientation-panel-integration.js",\n    "app/bottle-orientation-panel-recovery-integration.js",',
  "bottle visual recovery module"
);
write("app/bootstrap.js", bootstrap);

// 6. Advance client delivery IDs everywhere that owns the active build/cache.
let index = read("index.html");
index = index.split(`build=${PREVIOUS_BUILD}`).join(`build=${BUILD}`);
write("index.html", index);

let updateManager = read("app/update-manager.js");
updateManager = replaceOnce(updateManager, `const BUILD_ID = "${PREVIOUS_BUILD}";`, `const BUILD_ID = "${BUILD}";`, "update manager build");
write("app/update-manager.js", updateManager);

let serviceWorker = read("service-worker.js");
serviceWorker = replaceOnce(
  serviceWorker,
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-${PREVIOUS_BUILD}";`,
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-${BUILD}";`,
  "service worker cache"
);
if (!serviceWorker.includes('"./app/map-workspace-compact-support-integration.js"')) {
  serviceWorker = replaceOnce(
    serviceWorker,
    '  "./app/compact-layout-defaults-wipe-orientation-integration.js",',
    '  "./app/compact-layout-defaults-wipe-orientation-integration.js",\n  "./app/map-workspace-compact-support-integration.js",',
    "service worker map support asset"
  );
}
if (!serviceWorker.includes('"./app/bottle-orientation-panel-recovery-integration.js"')) {
  serviceWorker = replaceOnce(
    serviceWorker,
    '  "./app/bottle-orientation-panel-integration.js",',
    '  "./app/bottle-orientation-panel-integration.js",\n  "./app/bottle-orientation-panel-recovery-integration.js",',
    "service worker bottle recovery asset"
  );
}
write("service-worker.js", serviceWorker);

write("update-manifest.json", JSON.stringify({
  schemaVersion: 1,
  version: "0.9.10",
  buildId: BUILD,
  releaseUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  downloadUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  notes: "Staging v75 refines the 330°–30° entry/exit dead-zone overlay to a light translucent red, trims it to the operational overlay radius, and keeps its label above the 0° reference. It also caps the Direct-view mechanical-map height, moves Map Overlays and Label Wipe-Down directly beneath the map, and guarantees the Bottle Orientation & Wipe Visual remains visible at the top of Servo Program after program rerenders."
}, null, 2) + "\n");

// 7. Bring the existing v73 regression forward to the v75 presentation contract.
let deadZoneTest = read("tests/entry-exit-dead-zone-overlay.test.js");
deadZoneTest = deadZoneTest.replace(/entry-exit-dead-zone-overlay-v73-20260811-1604/g, BUILD);
deadZoneTest = replaceOnce(
  deadZoneTest,
  'assert(nodes.some((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30"));',
  'assert(nodes.some((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30"));\nconst sector = nodes.find((n) => n.attrs["data-entry-exit-dead-zone"] === "330-30");\nassert.equal(sector.attrs.fill, "#ef737a");\nassert.equal(sector.attrs["fill-opacity"], 0.22);',
  "dead-zone test light red checks"
);
deadZoneTest = deadZoneTest.replace(
  'console.log("Entry / exit dead zone overlay v73 regression passed.");',
  'for (const relative of ["app/mechanical-map-scene-renderer.js", "app/simulation-map-scene-renderer.js"]) { const source = fs.readFileSync(path.join(root, relative), "utf8"); assert.match(source, /deadZoneLabel/); assert.match(source, /svg\\.appendChild\\(deadZoneLabel\\)/); }\nassert.match(fs.readFileSync(overlayPath, "utf8"), /state\\.radius \\|\\| 0\\) - 24/);\nconsole.log("Entry / exit dead zone overlay v75 regression passed.");'
);
write("tests/entry-exit-dead-zone-overlay.test.js", deadZoneTest);

write("tests/map-workspace-bottle-visual-v75.test.js", `"use strict";\nconst assert = require("assert");\nconst fs = require("fs");\nconst path = require("path");\nconst root = path.resolve(__dirname, "..");\nconst layout = fs.readFileSync(path.join(root, "app/map-workspace-compact-support-integration.js"), "utf8");\nconst recovery = fs.readFileSync(path.join(root, "app/bottle-orientation-panel-recovery-integration.js"), "utf8");\nconst bootstrap = fs.readFileSync(path.join(root, "app/bootstrap.js"), "utf8");\nconst index = fs.readFileSync(path.join(root, "index.html"), "utf8");\nassert.match(layout, /map-support-panels/);\nassert.match(layout, /appendChild\\(overlays\\)/);\nassert.match(layout, /appendChild\\(wipeDown\\)/);\nassert.match(layout, /48vh/);\nassert.match(layout, /480px/);\nassert.match(recovery, /data-bottle-orientation-panel/);\nassert.match(recovery, /MutationObserver/);\nassert.match(recovery, /recoverSource/);\nassert.match(bootstrap, /map-workspace-compact-support-integration\\.js/);\nassert.match(bootstrap, /bottle-orientation-panel-recovery-integration\\.js/);\nassert.match(bootstrap, /${BUILD}/);\nassert.match(index, /build=${BUILD}/);\nconsole.log("Map workspace and Bottle Orientation v75 regression passed.");\n`);

console.log(`Applied ${BUILD}`);
