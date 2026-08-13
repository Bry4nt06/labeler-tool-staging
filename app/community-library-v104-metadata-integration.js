"use strict";

(function installCommunityMetadata(global) {
  if (global.ServoForgeCommunityLibraryV104?.installed) return;
  const base = global.LabelerCommunityLibrary;
  if (!base?.installed) return;

  const normalizeCode = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const normalizeSpec = (value) => String(value ?? "").trim().slice(0, 80);
  const baseApi = base.api.bind(base);

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

    const wrapper = document.createElement("label");
    wrapper.className = "sf-community-inline-spec";
    const caption = document.createElement("span");
    caption.textContent = "Spec #";
    const input = document.createElement("input");
    input.id = inputId;
    input.name = inputName;
    input.maxLength = 80;
    input.placeholder = "Spec #";
    input.autocomplete = "off";
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

  function bind() {
    if (!document.getElementById("servoforgeCommunityV104Styles")) {
      const style = document.createElement("style");
      style.id = "servoforgeCommunityV104Styles";
      style.textContent = ".sf-community-spec-select-row{display:grid;grid-template-columns:minmax(0,1fr) 126px;gap:6px;align-items:end}.sf-community-inline-spec{display:flex;flex-direction:column;gap:4px;min-width:0}.sf-community-inline-spec span{font-size:10.5px;color:var(--muted)}.sf-community-inline-spec input{width:100%;min-width:0}@media(max-width:560px){.sf-community-spec-select-row{grid-template-columns:1fr}}";
      document.head.appendChild(style);
    }

    const applyWhenReady = () => {
      enhance();
      if (!document.getElementById("communityUploadZone")) setTimeout(applyWhenReady, 25);
    };
    applyWhenReady();

    document.addEventListener("input", (event) => {
      if (!["communityZone", "communitySite"].includes(event.target?.name)) return;
      event.target.value = normalizeCode(event.target.value);
    });
    document.querySelector('[data-community-tab="upload"]')?.addEventListener("click", () => setTimeout(enhance, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.ServoForgeCommunityLibraryV104 = Object.freeze({ installed: true, enhance, normalizeCode });
})(typeof window !== "undefined" ? window : globalThis);
