"use strict";

const fs = require("fs");

const BUILD = "client-delivery-refresh-v74-20260811-1612";
const UPDATED = "Aug 11, 2026 4:12 PM ET";
const RELEASE = "0.9.10";

function read(path) { return fs.readFileSync(path, "utf8"); }
function write(path, text) { fs.writeFileSync(path, text); }
function replaceOnce(path, from, to, label) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`Missing ${label} in ${path}`);
  write(path, source.replace(from, to));
}

// Force every top-level runtime script onto one current cache key. Keeping the
// release version separate from the build ID also makes release-readiness
// checks correctly see v=0.9.10 instead of legacy suffixed version strings.
{
  const path = "index.html";
  let source = read(path);
  let count = 0;
  source = source.replace(/(<script\s+src="[^"]+?)\?v=[^"]+("\s*><\/script>)/g, (_match, base, end) => {
    count += 1;
    return `${base}?v=${RELEASE}&build=${BUILD}${end}`;
  });
  if (count < 20) throw new Error(`Expected to refresh at least 20 script tags; refreshed ${count}.`);
  write(path, source);
}

replaceOnce(
  "app/bootstrap.js",
  'const build = "entry-exit-dead-zone-overlay-v73-20260811-1604";\n  const buildUpdatedAt = "Aug 11, 2026 4:04 PM ET";',
  `const build = "${BUILD}";\n  const buildUpdatedAt = "${UPDATED}";`,
  "bootstrap build marker"
);
replaceOnce(
  "app/bootstrap.js",
  "// Regression lineage: entry-exit-dead-zone-overlay-v73-20260811-1604",
  `// Regression lineage: ${BUILD} • entry-exit-dead-zone-overlay-v73-20260811-1604`,
  "bootstrap regression lineage"
);

// The bootstrap-independent navigation layer is allowed to publish a fallback
// marker before bootstrap exists, but it must never overwrite a newer build on
// DOMContentLoaded/load.
replaceOnce(
  "app/setup-bindings.js",
  '  const BUILD = "bootstrap-independent-navigation-v69-20260811-1308";',
  '  const FALLBACK_BUILD = "bootstrap-independent-navigation-v69-20260811-1308";',
  "navigation fallback build constant"
);
replaceOnce(
  "app/setup-bindings.js",
  `  function publishBuildMarker() {\n    const banner = document.querySelector(".staging-environment-banner");\n    if (banner) {\n      banner.textContent = \`STAGING 0.9.10 • BUILD \${BUILD} • UPDATED Aug 11, 2026 1:08 PM ET — NOT PRODUCTION\`;\n    }\n  }`,
  `  function publishBuildMarker() {\n    const banner = document.querySelector(".staging-environment-banner");\n    if (!banner) return;\n    const activeBuild = String(global.ServoForgeBootstrapBuild || global.SERVOFORGE_BUILD_ID || "").trim();\n    const activeUpdatedAt = String(global.SERVOFORGE_BUILD_UPDATED_AT || "").trim();\n    if (activeBuild) {\n      banner.textContent = \`STAGING 0.9.10 • BUILD \${activeBuild} • UPDATED \${activeUpdatedAt || "current build"} — NOT PRODUCTION\`;\n      return;\n    }\n    banner.textContent = \`STAGING 0.9.10 • BUILD \${FALLBACK_BUILD} • UPDATED Aug 11, 2026 1:08 PM ET — NOT PRODUCTION\`;\n  }`,
  "navigation banner publisher"
);
replaceOnce(
  "app/setup-bindings.js",
  "    build: BUILD,",
  "    build: FALLBACK_BUILD,",
  "navigation exported fallback build"
);

// Dynamic orientation modules must share the current build cache key too.
replaceOnce(
  "app.js",
  '  const build = "editable-contact-parameters-v65-20260811-1051";',
  `  const build = "${BUILD}";`,
  "app dynamic module build"
);

// New SW URL/cache generation ensures old shell assets are retired.
replaceOnce(
  "service-worker.js",
  'const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-station1-bottle-orientation-v72";',
  `const CACHE_NAME = "servoforge-labeler-staging-v0.9.10-${BUILD}";`,
  "service worker cache generation"
);

// Make staging updates build-aware, not release-number-only.
replaceOnce(
  "app/update-manager.js",
  '  const RELEASE_VERSION = "0.9.10";\n  const APP_SCOPE = new URL("./", window.location.href).href;',
  `  const RELEASE_VERSION = "${RELEASE}";\n  const BUILD_ID = "${BUILD}";\n  const APP_SCOPE = new URL("./", window.location.href).href;`,
  "update manager build constant"
);
replaceOnce(
  "app/update-manager.js",
  `  function currentVersion() {\n    return document.querySelector('meta[name="application-version"]')?.content || RELEASE_VERSION;\n  }`,
  `  function currentVersion() {\n    return document.querySelector('meta[name="application-version"]')?.content || RELEASE_VERSION;\n  }\n\n  function currentBuild() {\n    return String(window.ServoForgeBootstrapBuild || window.SERVOFORGE_BUILD_ID || BUILD_ID).trim();\n  }`,
  "current build resolver"
);
replaceOnce(
  "app/update-manager.js",
  `  function destinationUrl(rawUrl, version) {\n    let destination;`,
  `  function destinationUrl(rawUrl, version, build) {\n    let destination;`,
  "destination build signature"
);
replaceOnce(
  "app/update-manager.js",
  `    destination.searchParams.set("version", String(version || RELEASE_VERSION));\n    destination.searchParams.set("updated", Date.now().toString());`,
  `    destination.searchParams.set("version", String(version || RELEASE_VERSION));\n    if (build) destination.searchParams.set("build", String(build));\n    destination.searchParams.set("updated", Date.now().toString());`,
  "destination build query"
);
replaceOnce(
  "app/update-manager.js",
  `  function navigateInCurrentWindow(rawUrl, version) {\n    saveBeforeNavigation();\n    window.location.replace(destinationUrl(rawUrl, version));\n  }`,
  `  function navigateInCurrentWindow(rawUrl, version, build) {\n    saveBeforeNavigation();\n    window.location.replace(destinationUrl(rawUrl, version, build));\n  }`,
  "navigate build argument"
);
replaceOnce(
  "app/update-manager.js",
  '      updateServiceWorkerRegistration = await navigator.serviceWorker.register(`./service-worker.js?v=${RELEASE_VERSION}`, {',
  '      updateServiceWorkerRegistration = await navigator.serviceWorker.register(`./service-worker.js?v=${RELEASE_VERSION}&build=${encodeURIComponent(BUILD_ID)}`, {',
  "service worker build query"
);
replaceOnce(
  "app/update-manager.js",
  `  checkForToolUpdates = async function checkForManagedToolUpdates() {\n    const installedVersion = currentVersion();\n    setStatus("Checking for updates…", "Check for Updates", true);`,
  `  checkForToolUpdates = async function checkForManagedToolUpdates() {\n    const installedVersion = currentVersion();\n    const installedBuild = currentBuild();\n    setStatus("Checking for updates…", "Check for Updates", true);`,
  "installed build capture"
);
replaceOnce(
  "app/update-manager.js",
  `      const latestVersion = String(manifest?.version || "").trim();\n      if (!latestVersion) throw new Error("Update manifest does not contain a version.");\n      if (compareVersions(latestVersion, installedVersion) <= 0) {\n        setStatus(\`Up to date • Version \${installedVersion}\`, "Check for Updates", false);\n        return;\n      }\n      const destination = String(manifest.releaseUrl || manifest.downloadUrl || APP_SCOPE).trim();\n      setStatus(\`Applying version \${latestVersion} in this window…\`, "Applying Update", true);\n      saveBeforeNavigation();\n      await clearStaleRuntime();\n      navigateInCurrentWindow(destination, latestVersion);`,
  `      const latestVersion = String(manifest?.version || "").trim();\n      const latestBuild = String(manifest?.buildId || "").trim();\n      if (!latestVersion) throw new Error("Update manifest does not contain a version.");\n      const versionComparison = compareVersions(latestVersion, installedVersion);\n      const sameBuild = !latestBuild || latestBuild === installedBuild;\n      if (versionComparison < 0 || (versionComparison === 0 && sameBuild)) {\n        setStatus(\`Up to date • Version \${installedVersion} • Build \${installedBuild}\`, "Check for Updates", false);\n        return;\n      }\n      const destination = String(manifest.releaseUrl || manifest.downloadUrl || APP_SCOPE).trim();\n      const updateLabel = versionComparison > 0 ? \`version \${latestVersion}\` : \`build \${latestBuild}\`;\n      setStatus(\`Applying \${updateLabel} in this window…\`, "Applying Update", true);\n      saveBeforeNavigation();\n      await clearStaleRuntime();\n      navigateInCurrentWindow(destination, latestVersion, latestBuild);`,
  "build-aware update comparison"
);

write("update-manifest.json", JSON.stringify({
  schemaVersion: 1,
  version: RELEASE,
  buildId: BUILD,
  releaseUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  downloadUrl: "https://bry4nt06.github.io/labeler-tool-staging/",
  notes: "Staging v74 repairs client delivery for the v72 and v73 updates. Runtime script cache keys are unified, the navigation safety layer no longer overwrites a newer build banner, service-worker cache generation advances, and Check for Updates now detects build changes inside release 0.9.10."
}, null, 2) + "\n");

// Regression assertions for the two updates the browser was missing.
const index = read("index.html");
const setup = read("app/setup-bindings.js");
const bootstrap = read("app/bootstrap.js");
const defaults = read("app/defaults.js");
const overlay = read("app/map-overlay-renderer.js");
const mechanical = read("app/mechanical-map-scene-renderer.js");
const simulation = read("app/simulation-map-scene-renderer.js");
const settings = read("app/controllers/settings-controller.js");
const events = read("app/controllers/setup-event-controller-integration.js");
const orientation = read("app/bottle-orientation-panel-integration.js");
const updater = read("app/update-manager.js");
const sw = read("service-worker.js");

const checks = [
  [index.includes('id="showEntryExitDeadZoneOverlay"'), "dead-zone toggle is present"],
  [defaults.includes("showEntryExitDeadZoneOverlay"), "dead-zone state is present"],
  [overlay.includes('data-entry-exit-dead-zone": "330-30"'), "330→30 renderer is present"],
  [mechanical.includes("drawEntryExitDeadZoneOverlay"), "mechanical map renders dead zone"],
  [simulation.includes("drawEntryExitDeadZoneOverlay"), "simulation map renders dead zone"],
  [settings.includes("setEntryExitDeadZone"), "dead-zone setting is independent"],
  [events.includes("showEntryExitDeadZoneOverlay"), "dead-zone event binding is present"],
  [orientation.includes("station1" ) || orientation.includes("Station 1"), "v72 orientation integration remains present"],
  [bootstrap.includes(BUILD), "bootstrap publishes v74"],
  [setup.includes("global.ServoForgeBootstrapBuild"), "navigation banner defers to bootstrap build"],
  [updater.includes("latestBuild") && updater.includes("installedBuild"), "update manager compares build IDs"],
  [sw.includes(BUILD), "service worker cache generation is v74"],
  [index.includes(`app.js?v=${RELEASE}&build=${BUILD}`), "app.js is cache-busted to v74"],
  [index.includes(`app/setup-bindings.js?v=${RELEASE}&build=${BUILD}`), "setup-bindings is cache-busted to v74"],
  [index.includes(`app/defaults.js?v=${RELEASE}&build=${BUILD}`), "defaults are cache-busted to v74"]
];
const failed = checks.filter(([ok]) => !ok).map(([, label]) => label);
if (failed.length) throw new Error(`v74 validation failed: ${failed.join(", ")}`);
console.log(`v74 client delivery refresh validated (${checks.length} checks).`);
