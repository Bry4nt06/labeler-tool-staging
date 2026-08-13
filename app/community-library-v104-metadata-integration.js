"use strict";
(function (global) {
  const lib = global.LabelerCommunityLibrary;
  if (!lib?.installed || global.ServoForgeCommunityLibraryV104) return;
  const originalApi = lib.api.bind(lib);
  const code = (v) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const spec = (v) => String(v ?? "").trim().slice(0, 80);

  lib.api = async function (action, payload = {}) {
    if (action === "upload") {
      const form = document.getElementById("communityUploadForm");
      const zone = code(form?.elements?.communityZone?.value);
      const site = code(form?.elements?.communitySite?.value);
      payload = {
        ...payload,
        validationSummary: {
          ...(payload.validationSummary || {}),
          communityZone: zone,
          communitySite: site,
          communityLocation: { zone, site },
          communityBottleSpecNumber: spec(form?.elements?.communityBottleSpecNumber?.value),
          communityBrandSpecNumber: spec(form?.elements?.communityBrandSpecNumber?.value)
        }
      };
    }
    return originalApi(action, payload);
  };

  function addSpec(fieldId, selectId, inputId, name) {
    const field = document.getElementById(fieldId);
    const select = document.getElementById(selectId);
    if (!field || !select || document.getElementById(inputId)) return;
    const row = document.createElement("div");
    row.className = "sf-community-v104-spec-row";
    select.parentNode.insertBefore(row, select);
    row.appendChild(select);
    const input = document.createElement("input");
    input.id = inputId;
    input.name = name;
    input.maxLength = 80;
    input.placeholder = "Spec #";
    input.setAttribute("aria-label", "Spec number");
    row.appendChild(input);
  }

  function enhance() {
    const zone = document.getElementById("communityUploadZone");
    const site = document.getElementById("communityUploadSite");
    [zone, site].forEach((input) => {
      if (!input) return;
      input.required = true;
      input.setAttribute("aria-required", "true");
      input.closest("label")?.querySelector("small")?.replaceChildren(document.createTextNode("required, max 3"));
    });
    addSpec("communityUploadBottleField", "communityUploadBottleSelect", "communityUploadBottleSpecNumber", "communityBottleSpecNumber");
    addSpec("communityUploadBrandField", "communityUploadBrandSelect", "communityUploadBrandSpecNumber", "communityBrandSpecNumber");
  }

  function bind() {
    const style = document.createElement("style");
    style.textContent = ".sf-community-v104-spec-row{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:6px}.sf-community-v104-spec-row input{min-width:0}@media(max-width:560px){.sf-community-v104-spec-row{grid-template-columns:1fr}}";
    document.head.appendChild(style);
    const form = document.getElementById("communityUploadForm");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      const zone = form.elements.communityZone;
      const site = form.elements.communitySite;
      if (zone) zone.value = code(zone.value);
      if (site) site.value = code(site.value);
      if (!zone?.value || !site?.value) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const status = document.getElementById("communityUploadStatus");
        if (status) status.textContent = "Zone and Site are required.";
        (!zone?.value ? zone : site)?.focus();
      }
    }, true);
    setTimeout(enhance, 0);
    document.querySelector('[data-community-tab="upload"]')?.addEventListener("click", () => setTimeout(enhance, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
  global.ServoForgeCommunityLibraryV104 = { installed: true };
})(typeof window !== "undefined" ? window : globalThis);
