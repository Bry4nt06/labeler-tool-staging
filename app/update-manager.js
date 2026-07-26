"use strict";

(function installServoForgeUpdateManager() {
  const RELEASE_VERSION = "0.9.1";
  const APP_SCOPE = new URL("./", window.location.href).href;
  const CACHE_PREFIX = "servoforge-labeler-staging-";

  window.SERVOFORGE_RELEASE_VERSION = RELEASE_VERSION;

  function currentVersion() {
    return document.querySelector('meta[name="application-version"]')?.content || RELEASE_VERSION;
  }

  function manifestUrl() {
    return document.querySelector('meta[name="update-manifest-url"]')?.content?.trim() || "./update-manifest.json";
  }

  function setStatus(message, buttonText = "Check for Updates", disabled = false) {
    if (typeof els !== "undefined" && els.updateCheckStatus) els.updateCheckStatus.textContent = message;
    if (typeof els !== "undefined" && els.checkForUpdates) {
      els.checkForUpdates.textContent = buttonText;
      els.checkForUpdates.disabled = disabled;
    }
  }

  function enforceReleaseVersion() {
    const meta = document.querySelector('meta[name="application-version"]');
    if (meta && meta.content !== RELEASE_VERSION) meta.content = RELEASE_VERSION;

    const status = typeof els !== "undefined" ? els.updateCheckStatus : document.querySelector("#updateCheckStatus");
    const currentText = status?.textContent || "";
    const releaseText = `Version ${RELEASE_VERSION} • Updates are checked automatically.`;
    const isIdleVersionText = /^Version\s+\d+/i.test(currentText)
      && !/available|downloading|applying|checking|up to date/i.test(currentText);
    if (status && isIdleVersionText && currentText !== releaseText) status.textContent = releaseText;
  }

  function versionParts(value) {
    return String(value || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
  }

  function compareVersions(left, right) {
    const a = versionParts(left);
    const b = versionParts(right);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const av = a[index] || 0;
      const bv = b[index] || 0;
      if (av !== bv) return av > bv ? 1 : -1;
    }
    return 0;
  }

  function destinationUrl(rawUrl, version) {
    let destination;
    try {
      destination = new URL(rawUrl || APP_SCOPE, APP_SCOPE);
    } catch {
      destination = new URL(APP_SCOPE);
    }
    destination.searchParams.set("version", String(version || RELEASE_VERSION));
    destination.searchParams.set("updated", Date.now().toString());
    return destination.toString();
  }

  async function clearStaleRuntime() {
    const tasks = [];
    if ("serviceWorker" in navigator) {
      tasks.push(
        navigator.serviceWorker.getRegistrations()
          .then((registrations) => Promise.all(
            registrations
              .filter((registration) => registration.scope.startsWith(APP_SCOPE))
              .map((registration) => registration.unregister())
          ))
      );
    }
    if ("caches" in window) {
      tasks.push(
        caches.keys().then((names) => Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX))
            .map((name) => caches.delete(name))
        ))
      );
    }
    await Promise.allSettled(tasks);
  }

  function saveBeforeNavigation() {
    try {
      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    } catch (error) {
      console.warn("Settings could not be saved before update navigation.", error);
    }
  }

  function navigateInCurrentWindow(rawUrl, version) {
    saveBeforeNavigation();
    window.location.replace(destinationUrl(rawUrl, version));
  }

  showPendingToolUpdate = function showManagedPendingUpdate() {
    setStatus("A browser update is ready. Apply it in this window.", "Apply Update", false);
  };

  registerToolUpdateService = async function registerManagedToolUpdateService() {
    enforceReleaseVersion();
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
    try {
      updateServiceWorkerRegistration = await navigator.serviceWorker.register(`./service-worker.js?v=${RELEASE_VERSION}`, {
        scope: "./",
        updateViaCache: "none"
      });
      updateServiceWorkerRegistration.update().catch(() => {});
    } catch (error) {
      console.warn("Service worker registration is unavailable; same-window updates remain enabled.", error);
    }
  };

  checkForToolUpdates = async function checkForManagedToolUpdates() {
    const installedVersion = currentVersion();
    setStatus("Checking for updates…", "Check for Updates", true);

    try {
      const source = manifestUrl();
      const response = await fetch(`${source}${source.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error(`Update server returned ${response.status}.`);

      const manifest = await response.json();
      const latestVersion = String(manifest?.version || "").trim();
      if (!latestVersion) throw new Error("Update manifest does not contain a version.");

      if (compareVersions(latestVersion, installedVersion) <= 0) {
        setStatus(`Up to date • Version ${installedVersion}`, "Check for Updates", false);
        return;
      }

      const destination = String(manifest.releaseUrl || manifest.downloadUrl || APP_SCOPE).trim();
      setStatus(`Applying version ${latestVersion} in this window…`, "Applying Update", true);
      saveBeforeNavigation();
      await clearStaleRuntime();
      navigateInCurrentWindow(destination, latestVersion);
    } catch (error) {
      console.error("Update check failed", error);
      setStatus("Unable to apply the update. Check the connection and try again.", "Check for Updates", false);
    }
  };

  enforceReleaseVersion();
  const versionMeta = document.querySelector('meta[name="application-version"]');
  const versionStatus = document.querySelector("#updateCheckStatus");
  const versionObserver = new MutationObserver(enforceReleaseVersion);
  if (versionMeta) versionObserver.observe(versionMeta, { attributes: true, attributeFilter: ["content"] });
  if (versionStatus) versionObserver.observe(versionStatus, { childList: true, subtree: true, characterData: true });
  window.addEventListener("load", enforceReleaseVersion, { once: true });
})();

(function scopeReleaseReadinessAssetVersions() {
  const driver = window.LabelerReleaseReadinessDriver;
  if (!driver?.run || driver.releaseManagedAssetScope) return;

  const baseRun = driver.run.bind(driver);
  const isModuleScopedNode = (node) => Array.from(node.attributes || [])
    .some((attribute) => attribute.name.startsWith("data-servoforge-"));

  function assetReport(expectedVersion) {
    const nodes = [
      ...document.querySelectorAll('script[src*="?v="]'),
      ...document.querySelectorAll('link[rel="stylesheet"][href*="?v="]')
    ];
    const releaseManaged = nodes.filter((node) => !isModuleScopedNode(node));
    const moduleScoped = nodes.filter(isModuleScopedNode);
    const entries = releaseManaged.map((node) => {
      const source = node.src || node.href;
      let version = "";
      try { version = new URL(source, window.location.href).searchParams.get("v") || ""; } catch { version = ""; }
      return { source, version };
    });
    const mismatches = entries.filter((entry) => entry.version !== expectedVersion);
    return { entries, mismatches, moduleScopedCount: moduleScoped.length };
  }

  function replaceAssetResult(report) {
    if (!report || !Array.isArray(report.results)) return report;
    const expectedVersion = report.version || window.SERVOFORGE_RELEASE_VERSION || "0.9.1";
    const assets = assetReport(expectedVersion);
    const replacement = {
      id: "version-assets",
      category: "release",
      level: assets.mismatches.length ? "fail" : assets.entries.length ? "pass" : "review",
      message: assets.mismatches.length
        ? `${assets.mismatches.length} release-managed asset${assets.mismatches.length === 1 ? " is" : "s are"} not aligned to ${expectedVersion}.`
        : assets.entries.length
          ? `${assets.entries.length} release-managed assets are aligned to ${expectedVersion}; ${assets.moduleScopedCount} independently versioned feature module${assets.moduleScopedCount === 1 ? " is" : "s are"} loaded.`
          : "No release-managed versioned application assets were detected.",
      expected: expectedVersion,
      mismatches: assets.mismatches
    };
    const existingIndex = report.results.findIndex((item) => item?.id === "version-assets");
    if (existingIndex >= 0) report.results.splice(existingIndex, 1, replacement);
    else report.results.push(replacement);
    const aggregate = driver.summarize(report.results);
    report.summary = aggregate.summary;
    report.categories = aggregate.categories;
    report.status = aggregate.status;
    return report;
  }

  window.LabelerReleaseReadinessDriver = Object.freeze({
    ...driver,
    releaseManagedAssetScope: true,
    async run(options = {}) {
      return replaceAssetResult(await baseRun(options));
    }
  });
})();
