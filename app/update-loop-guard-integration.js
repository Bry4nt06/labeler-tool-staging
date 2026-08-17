"use strict";

(function installServoForgeUpdateLoopGuard(global) {
  if (global.ServoForgeUpdateLoopGuard?.installed) return;

  const NAVIGATION_KEY = "servoforge-update-navigation-v2";
  const NAVIGATION_COOLDOWN_MS = 2 * 60 * 1000;
  const CACHE_PREFIX = "servoforge-labeler-";
  const APP_SCOPE = new URL("./", global.location.href).href;

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function currentVersion() {
    return text(global.document?.querySelector?.('meta[name="application-version"]')?.content || global.SERVOFORGE_RELEASE_VERSION || "0");
  }

  function currentBuild() {
    return text(global.ServoForgeBootstrapBuild || global.SERVOFORGE_BUILD_ID || "unknown-build");
  }

  function manifestUrl() {
    return text(global.document?.querySelector?.('meta[name="update-manifest-url"]')?.content || "./update-manifest.json");
  }

  function versionParts(value) {
    return text(value || "0").split(".").map((part) => Number.parseInt(part, 10) || 0);
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

  function setStatus(message, buttonText = "Check for Updates", disabled = false) {
    const status = typeof global.els !== "undefined" && global.els?.updateCheckStatus
      ? global.els.updateCheckStatus
      : global.document?.querySelector?.("#updateCheckStatus");
    const button = typeof global.els !== "undefined" && global.els?.checkForUpdates
      ? global.els.checkForUpdates
      : global.document?.querySelector?.("#checkForUpdates");
    if (status) status.textContent = message;
    if (button) {
      button.textContent = buttonText;
      button.disabled = disabled;
    }
  }

  function destinationUrl(rawUrl, version, build) {
    let destination;
    try {
      destination = new URL(rawUrl || APP_SCOPE, APP_SCOPE);
    } catch {
      destination = new URL(APP_SCOPE);
    }
    if (destination.pathname.endsWith("/")) destination.pathname += "index.html";
    destination.searchParams.set("version", text(version));
    if (build) destination.searchParams.set("build", text(build));
    destination.searchParams.set("updated", Date.now().toString());
    return destination.toString();
  }

  function readNavigationAttempt() {
    try {
      return JSON.parse(global.sessionStorage?.getItem?.(NAVIGATION_KEY) || "null");
    } catch {
      return null;
    }
  }

  function recordNavigationAttempt(version, build) {
    try {
      global.sessionStorage?.setItem?.(NAVIGATION_KEY, JSON.stringify({ version: text(version), build: text(build), timestamp: Date.now() }));
    } catch {
      // The URL target check below still prevents a reload loop when storage is unavailable.
    }
  }

  function alreadyAtTarget(version, build) {
    try {
      const url = new URL(global.location.href);
      if (url.searchParams.get("version") !== text(version)) return false;
      if (build && url.searchParams.get("build") !== text(build)) return false;
      return true;
    } catch {
      return false;
    }
  }

  function recentlyAttempted(version, build) {
    const attempt = readNavigationAttempt();
    if (!attempt) return false;
    return attempt.version === text(version)
      && attempt.build === text(build)
      && Date.now() - Number(attempt.timestamp || 0) < NAVIGATION_COOLDOWN_MS;
  }

  async function clearStaleRuntime() {
    const tasks = [];
    if ("serviceWorker" in global.navigator) {
      tasks.push(global.navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(
        registrations
          .filter((registration) => registration.scope.startsWith(APP_SCOPE))
          .map((registration) => registration.unregister())
      )));
    }
    if ("caches" in global) {
      tasks.push(global.caches.keys().then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX))
          .map((name) => global.caches.delete(name))
      )));
    }
    await Promise.allSettled(tasks);
  }

  function saveBeforeNavigation() {
    try {
      if (typeof global.saveCurrentSettings === "function") global.saveCurrentSettings();
    } catch (error) {
      console.warn("Settings could not be saved before update navigation.", error);
    }
  }

  async function checkForToolUpdatesSafely() {
    const installedVersion = currentVersion();
    const installedBuild = currentBuild();
    setStatus("Checking for updates…", "Check for Updates", true);

    try {
      const source = manifestUrl();
      const response = await global.fetch(`${source}${source.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" }
      });
      if (!response.ok) throw new Error(`Update server returned ${response.status}.`);

      const manifest = await response.json();
      const latestVersion = text(manifest?.version);
      const latestBuild = text(manifest?.buildId);
      if (!latestVersion) throw new Error("Update manifest does not contain a version.");

      const versionComparison = compareVersions(latestVersion, installedVersion);
      const sameBuild = !latestBuild || latestBuild === installedBuild;

      if (versionComparison < 0) {
        setStatus(`Running newer local build • Version ${installedVersion} • Build ${installedBuild}`, "Check for Updates", false);
        return { action: "none", reason: "installed-version-newer" };
      }

      // Build IDs are cache/diagnostic metadata, not a navigation boundary.
      // Staging changes build IDs frequently while remaining on the same release
      // version. Treating that drift as an update caused the historical boot loop.
      if (versionComparison === 0) {
        if (sameBuild) {
          setStatus(`Up to date • Version ${installedVersion} • Build ${installedBuild}`, "Check for Updates", false);
          return { action: "none", reason: "up-to-date" };
        }
        setStatus(`Build metadata differs • running ${installedBuild} • manifest ${latestBuild} • automatic reload suppressed`, "Check for Updates", false);
        global.ServoForgeUpdateDiagnostics = Object.freeze({
          installedVersion,
          installedBuild,
          manifestVersion: latestVersion,
          manifestBuild: latestBuild,
          sameVersionBuildMismatch: true,
          automaticReloadSuppressed: true
        });
        return { action: "suppressed", reason: "same-version-build-mismatch" };
      }

      const destination = text(manifest.releaseUrl || manifest.downloadUrl || APP_SCOPE);
      if (alreadyAtTarget(latestVersion, latestBuild) || recentlyAttempted(latestVersion, latestBuild)) {
        setStatus(`Update navigation stopped to prevent a reload loop • target ${latestVersion}${latestBuild ? ` / ${latestBuild}` : ""}`, "Check for Updates", false);
        global.ServoForgeUpdateDiagnostics = Object.freeze({
          installedVersion,
          installedBuild,
          manifestVersion: latestVersion,
          manifestBuild: latestBuild,
          navigationCircuitBreaker: true
        });
        return { action: "suppressed", reason: "navigation-circuit-breaker" };
      }

      setStatus(`Applying version ${latestVersion} in this window…`, "Applying Update", true);
      recordNavigationAttempt(latestVersion, latestBuild);
      saveBeforeNavigation();
      await clearStaleRuntime();
      global.location.replace(destinationUrl(destination, latestVersion, latestBuild));
      return { action: "navigate", version: latestVersion, build: latestBuild };
    } catch (error) {
      console.error("Update check failed", error);
      setStatus("Unable to check for updates. The current ServoForge session will remain loaded.", "Check for Updates", false);
      return { action: "error", error };
    }
  }

  global.checkForToolUpdates = checkForToolUpdatesSafely;
  global.ServoForgeUpdateLoopGuard = Object.freeze({
    installed: true,
    version: 2,
    navigationCooldownMs: NAVIGATION_COOLDOWN_MS,
    compareVersions,
    alreadyAtTarget,
    recentlyAttempted,
    checkForToolUpdatesSafely,
    sameVersionBuildReloadsDisabled: true,
    navigationCircuitBreaker: true
  });
})(typeof window !== "undefined" ? window : globalThis);
