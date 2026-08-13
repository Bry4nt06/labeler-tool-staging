"use strict";

(function alignReleaseReadinessToStaging() {
  const ENVIRONMENT = "staging";
  const BUILD_MARKER = "staging-readiness-v104-20260813-1851";
  const RETRY_MS = 50;
  let installed = false;
  let observer = null;
  let alignmentPending = false;

  function releaseVersion() {
    return String(
      window.SERVOFORGE_RELEASE_VERSION
      || document.querySelector('meta[name="application-version"]')?.content
      || "0.9.10"
    ).trim();
  }

  function alignInterface() {
    alignmentPending = false;
    const runButton = document.querySelector("#runReleaseReadiness");
    if (runButton && !runButton.disabled && runButton.textContent !== "Run Staging Check") {
      runButton.textContent = "Run Staging Check";
    }

    const controls = document.querySelector(".release-readiness-controls");
    const help = controls?.querySelector(".release-readiness-offline");
    if (help) {
      const current = help.textContent || "";
      const aligned = current
        .replace(/production application shell/gi, "staging application shell")
        .replace(/production release check/gi, "staging release check");
      if (aligned !== current) help.textContent = aligned;
    }
  }

  function scheduleAlignment() {
    if (alignmentPending) return;
    alignmentPending = true;
    window.requestAnimationFrame(alignInterface);
  }

  function install() {
    if (installed) return true;
    const driver = window.LabelerReleaseReadinessDriver;
    if (!driver?.run || driver.stagingAlignmentV3) return false;
    const baseRun = driver.run.bind(driver);
    const basePrepareOffline = typeof driver.prepareOffline === "function"
      ? driver.prepareOffline.bind(driver)
      : null;

    window.LabelerReleaseReadinessDriver = Object.freeze({
      ...driver,
      stagingAlignmentV3: true,
      stagingAlignmentBuild: BUILD_MARKER,
      async run(options = {}) {
        const expectedVersion = releaseVersion();
        const report = await baseRun({
          ...options,
          expectedVersion,
          environment: ENVIRONMENT
        });
        if (report) {
          report.version = expectedVersion;
          report.environment = ENVIRONMENT;
        }
        scheduleAlignment();
        return report;
      },
      ...(basePrepareOffline ? {
        async prepareOffline(options = {}) {
          const expectedVersion = releaseVersion();
          const response = await basePrepareOffline({
            ...options,
            expectedVersion,
            environment: ENVIRONMENT
          });
          scheduleAlignment();
          return response;
        }
      } : {})
    });

    installed = true;
    scheduleAlignment();
    observer = new MutationObserver(scheduleAlignment);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return true;
  }

  function wait() {
    if (install()) return;
    window.setTimeout(wait, RETRY_MS);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wait, { once: true });
  else wait();
})();