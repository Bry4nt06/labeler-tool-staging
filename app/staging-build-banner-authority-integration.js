"use strict";

(function installStagingBuildBannerAuthority(global) {
  const RETRY_MS = 25;
  let observer = null;
  let enforcing = false;

  function buildId() {
    return String(global.ServoForgeBootstrapBuild || global.SERVOFORGE_BUILD_ID || "").trim();
  }

  function updatedAt() {
    return String(global.ServoForgeBootstrapUpdatedAt || global.SERVOFORGE_BUILD_UPDATED_AT || "").trim();
  }

  function version() {
    return String(
      global.SERVOFORGE_RELEASE_VERSION
      || global.document?.querySelector?.('meta[name="application-version"]')?.content
      || "0.9.10"
    ).trim();
  }

  function expectedBanner() {
    const build = buildId();
    const updated = updatedAt();
    if (!build) return "";
    return `STAGING ${version()} • BUILD ${build}${updated ? ` • UPDATED ${updated}` : ""} — NOT PRODUCTION`;
  }

  function enforce() {
    if (enforcing) return;
    const build = String(global.ServoForgeBootstrapBuild || "").trim();
    if (!build) return;
    enforcing = true;
    try {
      global.SERVOFORGE_BUILD_ID = build;
      if (global.ServoForgeBootstrapUpdatedAt) global.SERVOFORGE_BUILD_UPDATED_AT = global.ServoForgeBootstrapUpdatedAt;
      const banner = global.document?.querySelector?.(".staging-environment-banner");
      const text = expectedBanner();
      if (banner && text && banner.textContent !== text) banner.textContent = text;
    } finally {
      enforcing = false;
    }
  }

  function install() {
    if (!global.document || !global.ServoForgeBootstrapBuild) return false;
    if (global.ServoForgeStagingBuildBannerAuthority?.installed) {
      enforce();
      return true;
    }

    enforce();
    const banner = global.document.querySelector(".staging-environment-banner");
    if (banner && typeof MutationObserver === "function") {
      observer = new MutationObserver(enforce);
      observer.observe(banner, { childList: true, subtree: true, characterData: true });
    }

    global.addEventListener?.("load", enforce);
    global.ServoForgeStagingBuildBannerAuthority = Object.freeze({
      installed: true,
      enforce,
      get buildId() { return buildId(); }
    });
    return true;
  }

  function wait() {
    if (!install()) global.setTimeout(wait, RETRY_MS);
  }

  wait();
})(typeof window !== "undefined" ? window : globalThis);
