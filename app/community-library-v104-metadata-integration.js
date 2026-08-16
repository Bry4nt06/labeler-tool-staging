"use strict";

(function installCommunityMetadata(global) {
  if (global.ServoForgeCommunityLibraryV104?.installed) return;
  const base = global.LabelerCommunityLibrary;
  if (!base?.installed) return;

  const BUILD = "community-railway-native-launch-v130-20260816-1555";
  const normalizeCode = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const normalizeSpec = (value) => String(value ?? "").trim().slice(0, 80);
  const baseApi = base.api.bind(base);
  const railwayHost = /\.up\.railway\.app$/i.test(String(global.location?.hostname || ""));
  let recoveryLoadPromise = null;
  let openingCommunity = false;

  async function api(action, payload = {}) {
    if (action !== "upload") return baseApi(action, payload);
    const form = document.getElementById("communityUploadForm");
    const zone = normalizeCode(form?.elements?.communityZone?.value);
    const site = normalizeCode(form?.elements?.communitySite?.value);
    if (!zone || !site) throw new Error("Zone and Site are required.");
    return baseApi(action, {
      ...payload,
      validationSummary: {
        ...(payload.validationSummary || {}),
        communityZone: zone,
        communitySite: site,
        communityLocation: { zone, site },
        communityBottleSpecNumber: normalizeSpec(form?.elements?.communityBottleSpecNumber?.value),
        communityBrandSpecNumber: normalizeSpec(form?.elements?.communityBrandSpecNumber?.value)
      }
    });
  }

  global.LabelerCommunityLibrary = Object.freeze({ ...base, api });

  function makeSpecInput(fieldId, selectId, inputId, inputName) {
    const field = document.getElementById(fieldId);
    const select = document.getElementById(selectId);
    if (!field || !select || document.getElementById(inputId)) return;

    const row = document.createElement("div");
    row.className = "sf-community-spec-select-row";
    select.parentNode.insertBefore(row, select);
    row.appendChild(select);

    const wrapper = document.createElement("span");
    wrapper.className = "sf-community-inline-spec";
    const caption = document.createElement("span");
    caption.textContent = "Spec #";
    const input = document.createElement("input");
    input.id = inputId;
    input.name = inputName;
    input.maxLength = 80;
    input.placeholder = "Spec #";
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Spec number");
    wrapper.append(caption, input);
    row.appendChild(wrapper);
  }

  function enhance() {
    const zone = document.getElementById("communityUploadZone");
    const site = document.getElementById("communityUploadSite");
    [[zone, "Zone"], [site, "Site"]].forEach(([input, label]) => {
      if (!input) return;
      input.required = true;
      input.setAttribute("aria-required", "true");
      const span = input.closest("label")?.querySelector("span");
      if (span) span.textContent = `${label} (required, max 3)`;
    });
    makeSpecInput("communityUploadBottleField", "communityUploadBottleSelect", "communityUploadBottleSpecNumber", "communityBottleSpecNumber");
    makeSpecInput("communityUploadBrandField", "communityUploadBrandSelect", "communityUploadBrandSpecNumber", "communityBrandSpecNumber");
  }

  function showDialog(dialog) {
    if (!dialog) return false;
    try {
      if (!dialog.open) dialog.showModal();
    } catch {
      dialog.setAttribute("open", "");
    }
    const browse = dialog.querySelector('[data-community-tab="browse"]');
    if (browse) browse.click();
    global.__SERVOFORGE_COMMUNITY_OPEN_STATE = "open";
    return true;
  }

  function installRecoveryNotice(message) {
    let notice = document.getElementById("servoforgeCommunityRecoveryNotice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "servoforgeCommunityRecoveryNotice";
      notice.setAttribute("role", "status");
      notice.style.cssText = "position:fixed;top:58px;right:16px;z-index:2147483647;max-width:360px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);box-shadow:0 12px 30px rgba(0,0,0,.35);font-size:12px";
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    clearTimeout(global.__sfCommunityRecoveryNoticeTimer);
    global.__sfCommunityRecoveryNoticeTimer = setTimeout(() => notice?.remove(), 4000);
  }

  function reloadBaseCommunity() {
    if (recoveryLoadPromise) return recoveryLoadPromise;
    recoveryLoadPromise = new Promise((resolve, reject) => {
      global.__SERVOFORGE_COMMUNITY_OPEN_STATE = "recovering";
      installRecoveryNotice("Opening Community Library…");
      try { delete global.LabelerCommunityLibrary; } catch { global.LabelerCommunityLibrary = undefined; }
      const script = document.createElement("script");
      script.src = `./app/community-library-integration.js?v=${encodeURIComponent(global.SERVOFORGE_RELEASE_VERSION || "0.9.10")}&build=community-launch-recovery-v107-${Date.now()}`;
      script.async = false;
      script.dataset.communityRecoveryLoader = "true";
      script.addEventListener("load", () => resolve(document.getElementById("servoforgeCommunityDialog")), { once: true });
      script.addEventListener("error", () => reject(new Error("Unable to reload the Community Library module.")), { once: true });
      document.body.appendChild(script);
    }).finally(() => { recoveryLoadPromise = null; });
    return recoveryLoadPromise;
  }

  function openCommunity() {
    if (openingCommunity) return Promise.resolve(true);
    openingCommunity = true;
    global.__SERVOFORGE_COMMUNITY_OPENING_V128 = true;

    const finish = () => {
      openingCommunity = false;
      global.__SERVOFORGE_COMMUNITY_OPENING_V128 = false;
    };

    const existing = document.getElementById("servoforgeCommunityDialog");
    if (existing) {
      try {
        return Promise.resolve(showDialog(existing));
      } finally {
        finish();
      }
    }

    return reloadBaseCommunity()
      .then((dialog) => {
        const recovered = dialog || document.getElementById("servoforgeCommunityDialog");
        if (!recovered) throw new Error("Community Library loaded but its dialog was not created.");
        enhance();
        return showDialog(recovered);
      })
      .catch((error) => {
        global.__SERVOFORGE_COMMUNITY_OPEN_STATE = `error:${error.message}`;
        installRecoveryNotice(`Community Library could not open: ${error.message}`);
        console.error("[ServoForge Community] launcher recovery failed", error);
        return false;
      })
      .finally(finish);
  }

  function recoverCommunityButton() {
    const button = document.getElementById("communityLibraryButton");
    if (!button) return false;

    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.style.pointerEvents = "auto";
    button.style.position = "relative";
    button.style.zIndex = "1002";
    const cluster = button.closest("#servoforgeTopActionCluster");
    if (cluster) {
      cluster.style.position = "relative";
      cluster.style.zIndex = "1001";
      cluster.style.pointerEvents = "auto";
    }

    // Railway already receives a normal, working Community button from the base
    // module. Do not install the legacy document-level coordinate recovery there;
    // it can compete with the native click path and is unnecessary on this host.
    if (railwayHost) {
      button.dataset.communityV107Recovery = "railway-native";
      global.__SERVOFORGE_COMMUNITY_RAILWAY_NATIVE_V130 = true;
      return true;
    }

    if (button.dataset.communityV107Recovery !== "true") {
      button.dataset.communityV107Recovery = "true";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        void openCommunity();
      }, true);
    }

    if (document.documentElement.dataset.communityCoordinateRecoveryV107 !== "true") {
      document.documentElement.dataset.communityCoordinateRecoveryV107 = "true";
      document.addEventListener("click", (event) => {
        if (!event.isTrusted) return;
        const current = document.getElementById("communityLibraryButton");
        if (!current) return;
        const rect = current.getBoundingClientRect();
        const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!inside) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void openCommunity();
      }, true);
    }
    return true;
  }

  function bind() {
    if (!document.getElementById("servoforgeCommunityV104Styles")) {
      const style = document.createElement("style");
      style.id = "servoforgeCommunityV104Styles";
      style.textContent = ".sf-community-spec-select-row{display:grid;grid-template-columns:minmax(0,1fr) 126px;gap:6px;align-items:end}.sf-community-inline-spec{display:flex;flex-direction:column;gap:4px;min-width:0}.sf-community-inline-spec>span{font-size:10.5px;color:var(--muted)}.sf-community-inline-spec input{width:100%;min-width:0}#servoforgeTopActionCluster{position:relative!important;z-index:1001!important;pointer-events:auto!important}#communityLibraryButton{position:relative!important;z-index:1002!important;pointer-events:auto!important}@media(max-width:560px){.sf-community-spec-select-row{grid-template-columns:1fr}}";
      document.head.appendChild(style);
    }

    let attempts = 0;
    const applyWhenReady = () => {
      attempts += 1;
      enhance();
      const buttonReady = recoverCommunityButton();
      const formReady = Boolean(document.getElementById("communityUploadZone") && document.getElementById("communityUploadSite"));
      if ((!buttonReady || !formReady) && attempts < 240) setTimeout(applyWhenReady, 25);
    };
    applyWhenReady();

    document.addEventListener("input", (event) => {
      if (!["communityZone", "communitySite"].includes(event.target?.name)) return;
      event.target.value = normalizeCode(event.target.value);
    });
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.('[data-community-tab="upload"]')) setTimeout(enhance, 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.ServoForgeCommunityLibraryV104 = Object.freeze({ installed: true, build: BUILD, enhance, recoverCommunityButton, openCommunity, reloadBaseCommunity, normalizeCode, communityOpenReentryGuardV128: true, trustedCoordinateRecoveryOnlyV128: true, railwayNativeLaunchV130: railwayHost });
})(typeof window !== "undefined" ? window : globalThis);
