"use strict";

(function startServoForgeTroubleshootingBootstrap(global) {
  const BUILD = "troubleshooting-bootstrap-v358-20260904";
  const CACHE_PREFIX = "servoforge-labeler-";
  const MANIFEST_ID = "troubleshootingScriptManifest";
  const STATUS_ID = "libraryValidationStatus";
  const REPAIR_ID = "troubleshootingCacheRepair";
  const LOAD_TIMEOUT_MS = 15000;
  const POST_LOAD_WATCHDOG_MS = 5000;

  const state = {
    build: BUILD,
    currentIndex: -1,
    currentSrc: "",
    firstFailure: "",
    loaded: [],
    repaired: false,
    aborted: false
  };
  global.ServoForgeTroubleshootingBootstrap = state;

  function statusElement() { return document.getElementById(STATUS_ID); }
  function repairElement() { return document.getElementById(REPAIR_ID); }
  function filename(value) {
    try { return new URL(value, location.href).pathname.split("/").pop() || String(value || "unknown file"); }
    catch { return String(value || "unknown file"); }
  }
  function setStatus(message, status = "") {
    const element = statusElement();
    if (!element) return;
    element.textContent = message;
    if (status) element.dataset.status = status;
    else delete element.dataset.status;
  }
  function fail(message) {
    if (!state.firstFailure) state.firstFailure = message;
    state.aborted = true;
    setStatus(message, "fail");
    const repair = repairElement();
    if (repair) repair.hidden = false;
  }
  function nextPaint() {
    return new Promise((resolve) => {
      const schedule = typeof global.requestAnimationFrame === "function"
        ? global.requestAnimationFrame.bind(global)
        : (callback) => global.setTimeout(callback, 0);
      schedule(() => global.setTimeout(resolve, 0));
    });
  }
  function readManifest() {
    const element = document.getElementById(MANIFEST_ID);
    if (!element) throw new Error("Troubleshooting startup manifest is missing.");
    const parsed = JSON.parse(element.textContent || "[]");
    if (!Array.isArray(parsed) || !parsed.length || parsed.some((item) => typeof item !== "string" || !item.trim())) {
      throw new Error("Troubleshooting startup manifest is invalid.");
    }
    return parsed;
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const timeout = global.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Startup file timed out: ${filename(src)}`));
      }, LOAD_TIMEOUT_MS);
      const complete = (callback, value) => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeout);
        callback(value);
      };
      script.src = src;
      script.async = false;
      script.dataset.servoforgeTroubleshootingModule = "true";
      script.onload = () => complete(resolve);
      script.onerror = () => complete(reject, new Error(`Startup file failed to load: ${filename(src)}`));
      document.head.appendChild(script);
    });
  }

  global.addEventListener("error", (event) => {
    const target = event.target;
    if (target?.tagName === "SCRIPT" && target.dataset?.servoforgeTroubleshootingModule === "true") {
      fail(`Startup file failed: ${filename(target.src)}. Use Repair local cache, then reload.`);
      return;
    }
    if (state.currentSrc && event.message) {
      fail(`Startup error in ${filename(state.currentSrc)}: ${event.message}`);
    }
  }, true);
  global.addEventListener("unhandledrejection", (event) => {
    if (!state.currentSrc) return;
    const reason = event.reason?.message || event.reason || "Unknown startup failure";
    fail(`Startup error in ${filename(state.currentSrc)}: ${String(reason)}`);
  });

  document.addEventListener("click", async (event) => {
    const button = event.target.closest?.(`#${REPAIR_ID}`);
    if (!button || button.disabled) return;
    button.disabled = true;
    setStatus("Repairing local troubleshooting cache…");
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(registrations
          .filter((registration) => registration.scope.startsWith(location.origin))
          .map((registration) => registration.unregister()));
      }
      if ("caches" in global) {
        const names = await caches.keys();
        await Promise.allSettled(names
          .filter((name) => name.startsWith(CACHE_PREFIX))
          .map((name) => caches.delete(name)));
      }
      state.repaired = true;
      const next = new URL("./index.html", location.href);
      next.searchParams.set("cacheRepair", "v358");
      next.searchParams.set("t", Date.now().toString());
      location.replace(next.href);
    } catch (error) {
      button.disabled = false;
      fail(`Cache repair could not complete: ${error?.message || error}`);
    }
  });

  async function start() {
    let manifest;
    try { manifest = readManifest(); }
    catch (error) {
      fail(error.message || String(error));
      return;
    }

    for (let index = 0; index < manifest.length; index += 1) {
      if (state.aborted) return;
      const src = manifest[index];
      state.currentIndex = index;
      state.currentSrc = src;
      setStatus(`Starting diagnostics ${index + 1}/${manifest.length}: ${filename(src)}`);
      await nextPaint();
      if (state.aborted) return;
      try {
        await loadScript(src);
        state.loaded.push(src);
      } catch (error) {
        fail(`${error.message || error}. Use Repair local cache, then reload.`);
        return;
      }
      await new Promise((resolve) => global.setTimeout(resolve, 0));
    }

    state.currentSrc = "";
    state.currentIndex = manifest.length;
    const current = statusElement();
    if (current && /^Starting diagnostics /.test(current.textContent || "")) {
      setStatus("Diagnostic modules loaded; initializing troubleshooting interface…");
    }
    global.setTimeout(() => {
      const status = statusElement();
      if (!status || status.dataset.status === "pass") return;
      if (/diagnostic modules loaded|starting diagnostics/i.test(status.textContent || "")) {
        fail("Troubleshooting modules loaded but the interface did not finish initializing. Reload this page; your saved ServoForge workspace was preserved.");
      }
    }, POST_LOAD_WATCHDOG_MS);
  }

  start().catch((error) => fail(`Troubleshooting bootstrap failed: ${error?.message || error}`));
})(window);
