"use strict";

(function installReliableToolUpdater() {
  const UPDATE_WAIT_TIMEOUT_MS = 15000;

  function currentApplicationVersion() {
    return document.querySelector('meta[name="application-version"]')?.content || "0.0.0";
  }

  function updateManifestUrl() {
    return document.querySelector('meta[name="update-manifest-url"]')?.content?.trim() || "";
  }

  function setUpdateUi(message, buttonText = "Check for Updates", disabled = false) {
    if (els.updateCheckStatus) els.updateCheckStatus.textContent = message;
    if (els.checkForUpdates) {
      els.checkForUpdates.textContent = buttonText;
      els.checkForUpdates.disabled = disabled;
    }
  }

  function waitForWorkerInstalled(worker, timeoutMs = UPDATE_WAIT_TIMEOUT_MS) {
    return new Promise((resolve) => {
      if (!worker) {
        resolve(null);
        return;
      }
      if (worker.state === "installed" || worker.state === "activated") {
        resolve(worker);
        return;
      }
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        worker.removeEventListener("statechange", onStateChange);
        resolve(value);
      };
      const onStateChange = () => {
        if (worker.state === "installed" || worker.state === "activated") finish(worker);
        else if (worker.state === "redundant") finish(null);
      };
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      worker.addEventListener("statechange", onStateChange);
    });
  }

  function waitForRegistrationWorker(registration, timeoutMs = UPDATE_WAIT_TIMEOUT_MS) {
    return new Promise((resolve) => {
      if (registration.waiting) {
        resolve(registration.waiting);
        return;
      }
      if (registration.installing) {
        waitForWorkerInstalled(registration.installing, timeoutMs).then(resolve);
        return;
      }
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        registration.removeEventListener("updatefound", onUpdateFound);
        resolve(value);
      };
      const onUpdateFound = () => {
        const worker = registration.installing;
        waitForWorkerInstalled(worker, timeoutMs).then(finish);
      };
      const timer = window.setTimeout(() => finish(registration.waiting || null), timeoutMs);
      registration.addEventListener("updatefound", onUpdateFound);
    });
  }

  async function getUpdateRegistration() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return null;
    const registration = updateServiceWorkerRegistration
      || await navigator.serviceWorker.register("./service-worker.js", {
        scope: "./",
        updateViaCache: "none"
      });
    updateServiceWorkerRegistration = registration;
    return registration;
  }

  function applyWaitingWorker(worker) {
    if (!worker) return false;
    pendingServiceWorker = worker;
    setUpdateUi("Applying update…", "Applying Update", true);
    if (typeof saveCurrentSettings === "function") saveCurrentSettings();
    worker.postMessage({ type: "SKIP_WAITING" });
    return true;
  }

  registerToolUpdateService = async function registerReliableToolUpdateService() {
    if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
    try {
      const registration = await getUpdateRegistration();
      if (!registration) return;
      if (registration.waiting) showPendingToolUpdate(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        installing?.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            showPendingToolUpdate(installing);
          }
        });
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloadingForServiceWorker) return;
        reloadingForServiceWorker = true;
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("updated", Date.now().toString());
        window.location.replace(nextUrl.toString());
      });
      await registration.update();
    } catch (error) {
      console.error("Automatic update service unavailable", error);
    }
  };

  checkForToolUpdates = async function checkForReliableToolUpdates() {
    const currentVersion = currentApplicationVersion();
    const manifestUrl = updateManifestUrl();

    if (pendingServiceWorker) {
      applyWaitingWorker(pendingServiceWorker);
      return;
    }

    setUpdateUi("Checking for updates…", "Check for Updates", true);
    try {
      if (!manifestUrl) {
        setUpdateUi(`Version ${currentVersion} • Update source not configured yet.`);
        return;
      }

      const response = await fetch(`${manifestUrl}${manifestUrl.includes("?") ? "&" : "?"}t=${Date.now()}`, {
        cache: "no-store"
      });
      if (!response.ok) throw new Error(`Update server returned ${response.status}.`);
      const manifest = await response.json();
      const latestVersion = String(manifest?.version || "").trim();
      if (!latestVersion) throw new Error("Update manifest has no version.");

      if (compareApplicationVersions(latestVersion, currentVersion) <= 0) {
        setUpdateUi(`Up to date • Version ${currentVersion}`);
        return;
      }

      setUpdateUi(`Downloading version ${latestVersion}…`, "Downloading Update", true);
      const registration = await getUpdateRegistration();
      if (!registration) {
        throw new Error("Service workers are unavailable in this browser.");
      }

      const workerPromise = waitForRegistrationWorker(registration);
      await registration.update();
      const worker = registration.waiting || await workerPromise;
      if (applyWaitingWorker(registration.waiting || worker)) return;

      if (typeof saveCurrentSettings === "function") saveCurrentSettings();
      setUpdateUi(`Opening version ${latestVersion}…`, "Applying Update", true);
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("version", latestVersion);
      nextUrl.searchParams.set("updated", Date.now().toString());
      window.location.replace(nextUrl.toString());
    } catch (error) {
      setUpdateUi("Unable to apply the update. Check the connection and try again.");
      console.error("Update check failed", error);
    }
  };
})();

(function loadMilestonesSixAndSeven() {
  if (window.LabelerMechanicalEventPlannerDriver) return;
  const plannerScript = document.createElement("script");
  plannerScript.src = "drivers/planning/mechanical-event-planner-driver.js?v=0.8.0";
  plannerScript.addEventListener("load", () => {
    const integrationScript = document.createElement("script");
    integrationScript.src = "app/milestone-6-7-integration.js?v=0.8.0";
    document.head.appendChild(integrationScript);
  });
  document.head.appendChild(plannerScript);
})();
