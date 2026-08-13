"use strict";

(function installServoForgeCommunityLibraryV103(global) {
  if (global.ServoForgeCommunityLibraryV103?.installed) return;

  const library = global.LabelerCommunityLibrary;
  if (!library?.installed) return;

  const BUILD_MARKER = "community-library-v103-20260813-1756";
  const LOCATION_LIMIT = 3;
  const browseMetadata = new Map();
  let catalogLoaded = false;
  let lastSuggestedName = "";

  function runtimeState() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeCode(value) {
    return String(value ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, LOCATION_LIMIT);
  }

  function selectedMapFromWorkspace() {
    const source = runtimeState();
    if (typeof global.selectedMachineMap === "function") return global.selectedMachineMap();
    return source?.mapLibrary?.find?.((map) => String(map?.id) === String(source?.activeMapId)) || source?.mapLibrary?.[0] || null;
  }

  function selectedBottleFromWorkspace() {
    const source = runtimeState();
    return source?.bottleSpecs?.find?.((row) => String(row?.bottleType || "") === String(source?.selectedBottle || "")) || source?.bottleSpecs?.[0] || null;
  }

  function selectedBrandFromWorkspace() {
    const source = runtimeState();
    return source?.labelSpecs?.find?.((row) => String(row?.brand || "") === String(source?.selectedBrand || "")) || source?.labelSpecs?.[0] || null;
  }

  function ensureStyles() {
    if (document.getElementById("servoforgeCommunityV103Styles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeCommunityV103Styles";
    style.textContent = `
      .sf-community-dialog{width:min(980px,calc(100vw - 24px));max-height:min(790px,calc(100vh - 24px))}
      .sf-community-head{padding:10px 14px;gap:8px}.sf-community-head h2{font-size:16px}.sf-community-head p{font-size:11px;margin-top:2px}.sf-community-close{padding:6px 9px;font-size:12px}
      .sf-community-tabs{padding:8px 14px 0;gap:6px}.sf-community-tabs button{padding:6px 9px;font-size:12px}
      .sf-community-body{padding:12px}.sf-community-toolbar{grid-template-columns:minmax(220px,1fr) 108px 108px 150px auto;gap:6px;margin-bottom:9px}
      .sf-community-toolbar input,.sf-community-toolbar select,.sf-community-field input,.sf-community-field select,.sf-community-field textarea,.sf-community-admin-status{padding:7px 8px;font-size:12px}
      .sf-community-list{gap:8px}.sf-community-card{padding:9px 10px;border-radius:8px}.sf-community-card-head{gap:7px}.sf-community-card-head h3{font-size:13px;line-height:1.2}
      .sf-community-meta{font-size:10.5px;margin-top:2px;line-height:1.25}.sf-community-badge{font-size:9.5px;padding:2px 6px}.sf-community-description{font-size:11px;margin:6px 0;line-height:1.3}
      .sf-community-card-actions{margin-top:6px;gap:6px}.sf-community-card-actions button{padding:5px 8px;font-size:11px}.sf-community-stars span,.sf-community-stars button{font-size:14px}
      .sf-community-rating-editor{grid-template-columns:auto minmax(180px,1fr) auto;gap:6px;margin-top:6px}.sf-community-rating-editor input{padding:5px 7px;font-size:11px}.sf-community-rating-editor button{padding:5px 8px;font-size:11px}
      .sf-community-grid{gap:8px}.sf-community-field{gap:4px;font-size:12px}.sf-community-field textarea{min-height:70px}.sf-community-preview{padding:9px;margin-top:8px;font-size:11px}.sf-community-note,.sf-community-status{font-size:10.5px}
      .sf-community-location-line{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.sf-community-location-chip{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:999px;padding:2px 6px;font-size:9.5px;color:var(--muted);background:var(--input)}
      .sf-community-upload-selectors{display:contents}.sf-community-upload-selector[hidden]{display:none!important}
      @media(max-width:820px){.sf-community-toolbar{grid-template-columns:1fr 1fr}.sf-community-toolbar #communitySearch{grid-column:1/-1}.sf-community-toolbar #communityRefresh{grid-column:1/-1}.sf-community-rating-editor{grid-template-columns:1fr}}
      @media(max-width:560px){.sf-community-toolbar{grid-template-columns:1fr}.sf-community-toolbar #communitySearch,.sf-community-toolbar #communityRefresh{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function ensureBrowseFilters() {
    const toolbar = document.querySelector('[data-community-pane="browse"] .sf-community-toolbar');
    const typeFilter = document.getElementById("communityTypeFilter");
    if (!toolbar || !typeFilter) return;

    if (!document.getElementById("communityZoneFilter")) {
      const zone = document.createElement("select");
      zone.id = "communityZoneFilter";
      zone.setAttribute("aria-label", "Community zone filter");
      zone.innerHTML = '<option value="">Zone: All</option>';
      toolbar.insertBefore(zone, typeFilter);
    }
    if (!document.getElementById("communitySiteFilter")) {
      const site = document.createElement("select");
      site.id = "communitySiteFilter";
      site.setAttribute("aria-label", "Community site filter");
      site.innerHTML = '<option value="">Site: All</option>';
      toolbar.insertBefore(site, typeFilter);
    }
  }

  function optionHtml(prefix, values, selected) {
    const options = [`<option value="">${prefix}: All</option>`];
    [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((value) => {
      options.push(`<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${prefix} ${esc(value)}</option>`);
    });
    return options.join("");
  }

  function metadataLocation(item) {
    const summary = item?.validationSummary || {};
    return {
      zone: normalizeCode(item?.zoneCode || summary.communityZone || summary.communityLocation?.zone || ""),
      site: normalizeCode(item?.siteCode || summary.communitySite || summary.communityLocation?.site || "")
    };
  }

  function updateBrowseMetadata(items) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      const location = metadataLocation(item);
      browseMetadata.set(String(item?.id || ""), { ...location, packageNumber: item?.packageNumber });
    });
  }

  function populateLocationFilters(items) {
    ensureBrowseFilters();
    const zones = new Set();
    const sites = new Set();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const { zone, site } = metadataLocation(item);
      if (zone) zones.add(zone);
      if (site) sites.add(site);
    });
    const zoneSelect = document.getElementById("communityZoneFilter");
    const siteSelect = document.getElementById("communitySiteFilter");
    if (zoneSelect) {
      const selected = normalizeCode(zoneSelect.value);
      zoneSelect.innerHTML = optionHtml("Zone", zones, selected);
      if (selected && zones.has(selected)) zoneSelect.value = selected;
    }
    if (siteSelect) {
      const selected = normalizeCode(siteSelect.value);
      siteSelect.innerHTML = optionHtml("Site", sites, selected);
      if (selected && sites.has(selected)) siteSelect.value = selected;
    }
  }

  async function loadLocationCatalog(force = false) {
    if (catalogLoaded && !force) return;
    try {
      const data = await library.api("browse", { type: "", search: "" });
      const items = Array.isArray(data?.packages) ? data.packages : [];
      updateBrowseMetadata(items);
      populateLocationFilters(items);
      catalogLoaded = true;
      applyBrowseLocationFilter();
    } catch {
      // The existing Community UI already reports API failures. Location
      // filters remain on "All" if the catalog cannot be refreshed.
    }
  }

  function ensureLocationChips(card, location) {
    card.querySelector(".sf-community-location-line")?.remove();
    if (!location?.zone && !location?.site) return;
    const head = card.querySelector(".sf-community-card-head");
    if (!head) return;
    const line = document.createElement("div");
    line.className = "sf-community-location-line";
    line.innerHTML = `${location.zone ? `<span class="sf-community-location-chip">Zone ${esc(location.zone)}</span>` : ""}${location.site ? `<span class="sf-community-location-chip">Site ${esc(location.site)}</span>` : ""}`;
    head.insertAdjacentElement("afterend", line);
  }

  function applyBrowseLocationFilter() {
    const host = document.getElementById("communityBrowseList");
    if (!host) return;
    const zone = normalizeCode(document.getElementById("communityZoneFilter")?.value || "");
    const site = normalizeCode(document.getElementById("communitySiteFilter")?.value || "");
    const cards = [...host.querySelectorAll(".sf-community-card[data-community-package-id]")];
    let visible = 0;
    cards.forEach((card) => {
      const location = browseMetadata.get(String(card.dataset.communityPackageId || "")) || { zone: "", site: "" };
      ensureLocationChips(card, location);
      const matches = (!zone || location.zone === zone) && (!site || location.site === site);
      card.hidden = !matches;
      if (matches) visible += 1;
    });

    let empty = document.getElementById("communityLocationFilterEmpty");
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "communityLocationFilterEmpty";
      empty.className = "sf-community-empty";
      empty.hidden = true;
      host.appendChild(empty);
    }
    empty.textContent = "No published packages match the selected Zone and Site filters.";
    empty.hidden = !(cards.length > 0 && visible === 0);
  }

  function selectOptions(rows, labeler, selectedIndex = -1) {
    if (!rows.length) return '<option value="">No saved options available</option>';
    return rows.map((row, index) => `<option value="${index}" ${index === selectedIndex ? "selected" : ""}>${esc(labeler(row, index))}</option>`).join("");
  }

  function ensureUploadSelectors() {
    const form = document.getElementById("communityUploadForm");
    const grid = form?.querySelector(".sf-community-grid");
    const listing = form?.elements?.name?.closest?.(".sf-community-field");
    if (!form || !grid || !listing) return;

    if (!document.getElementById("communityUploadZone")) {
      const zone = document.createElement("label");
      zone.className = "sf-community-field";
      zone.innerHTML = '<span>Zone <small>(optional, max 3)</small></span><input id="communityUploadZone" name="communityZone" maxlength="3" inputmode="text" autocomplete="off" placeholder="XXX" />';
      grid.insertBefore(zone, listing);
    }
    if (!document.getElementById("communityUploadSite")) {
      const site = document.createElement("label");
      site.className = "sf-community-field";
      site.innerHTML = '<span>Site <small>(optional, max 3)</small></span><input id="communityUploadSite" name="communitySite" maxlength="3" inputmode="text" autocomplete="off" placeholder="XXX" />';
      grid.insertBefore(site, listing);
    }
    if (!document.getElementById("communityUploadMapSelect")) {
      const map = document.createElement("label");
      map.className = "sf-community-field sf-community-upload-selector";
      map.id = "communityUploadMapField";
      map.innerHTML = '<span>Machine Map</span><select id="communityUploadMapSelect" name="communityMapIndex"></select>';
      grid.insertBefore(map, listing);
    }
    if (!document.getElementById("communityUploadBottleSelect")) {
      const bottle = document.createElement("label");
      bottle.className = "sf-community-field sf-community-upload-selector";
      bottle.id = "communityUploadBottleField";
      bottle.innerHTML = '<span>Bottle spec</span><select id="communityUploadBottleSelect" name="communityBottleIndex"></select>';
      grid.insertBefore(bottle, listing);
    }
    if (!document.getElementById("communityUploadBrandSelect")) {
      const brand = document.createElement("label");
      brand.className = "sf-community-field sf-community-upload-selector";
      brand.id = "communityUploadBrandField";
      brand.innerHTML = '<span>Brand / Label spec</span><select id="communityUploadBrandSelect" name="communityBrandIndex"></select>';
      grid.insertBefore(brand, listing);
    }

    const note = form.querySelector("#communityUploadSummary")?.nextElementSibling;
    if (note?.classList.contains("sf-community-note")) {
      note.textContent = "Choose from the Maps, Bottle specs, and Brand / Label specs already saved in this ServoForge workspace. Uploads are copied and sent for admin review; Community packages contain JSON configuration only.";
    }
  }

  function populateUploadSelectors() {
    ensureUploadSelectors();
    const source = runtimeState();
    const maps = Array.isArray(source?.mapLibrary) ? source.mapLibrary : [];
    const bottles = Array.isArray(source?.bottleSpecs) ? source.bottleSpecs : [];
    const brands = Array.isArray(source?.labelSpecs) ? source.labelSpecs : [];

    const activeMap = selectedMapFromWorkspace();
    const activeBottle = selectedBottleFromWorkspace();
    const activeBrand = selectedBrandFromWorkspace();
    const mapIndex = Math.max(0, maps.findIndex((row) => row === activeMap || String(row?.id) === String(activeMap?.id)));
    const bottleIndex = Math.max(0, bottles.findIndex((row) => row === activeBottle || String(row?.bottleType || "") === String(activeBottle?.bottleType || "")));
    const brandIndex = Math.max(0, brands.findIndex((row) => row === activeBrand || String(row?.brand || "") === String(activeBrand?.brand || "")));

    const mapSelect = document.getElementById("communityUploadMapSelect");
    const bottleSelect = document.getElementById("communityUploadBottleSelect");
    const brandSelect = document.getElementById("communityUploadBrandSelect");
    if (mapSelect) mapSelect.innerHTML = selectOptions(maps, (row) => row?.name || "Unnamed map", maps.length ? mapIndex : -1);
    if (bottleSelect) bottleSelect.innerHTML = selectOptions(bottles, (row) => row?.bottleType || "Unnamed bottle", bottles.length ? bottleIndex : -1);
    if (brandSelect) brandSelect.innerHTML = selectOptions(brands, (row) => row?.brand || "Unnamed brand", brands.length ? brandIndex : -1);
    updateUploadFieldVisibility();
  }

  function updateUploadFieldVisibility() {
    const form = document.getElementById("communityUploadForm");
    if (!form) return;
    const type = String(form.elements.type?.value || "bundle");
    const showMap = type === "map" || type === "bundle";
    const showBottle = type === "bottle" || type === "bundle";
    const showBrand = type === "brand" || type === "bundle";
    const mapField = document.getElementById("communityUploadMapField");
    const bottleField = document.getElementById("communityUploadBottleField");
    const brandField = document.getElementById("communityUploadBrandField");
    if (mapField) mapField.hidden = !showMap;
    if (bottleField) bottleField.hidden = !showBottle;
    if (brandField) brandField.hidden = !showBrand;
  }

  function selectedUploadRecords() {
    const source = runtimeState();
    const maps = Array.isArray(source?.mapLibrary) ? source.mapLibrary : [];
    const bottles = Array.isArray(source?.bottleSpecs) ? source.bottleSpecs : [];
    const brands = Array.isArray(source?.labelSpecs) ? source.labelSpecs : [];
    const mapIndex = Number(document.getElementById("communityUploadMapSelect")?.value);
    const bottleIndex = Number(document.getElementById("communityUploadBottleSelect")?.value);
    const brandIndex = Number(document.getElementById("communityUploadBrandSelect")?.value);
    return {
      map: Number.isInteger(mapIndex) ? maps[mapIndex] || null : null,
      bottle: Number.isInteger(bottleIndex) ? bottles[bottleIndex] || null : null,
      brand: Number.isInteger(brandIndex) ? brands[brandIndex] || null : null
    };
  }

  function uploadPackage(type) {
    const { map, bottle, brand } = selectedUploadRecords();
    if (type === "map") {
      if (!map) throw new Error("Choose a Machine Map to upload.");
      return { payload: { map: JSON.parse(JSON.stringify(map)) }, name: map.name || "Community Map", map, bottle: null, brand: null };
    }
    if (type === "bottle") {
      if (!bottle) throw new Error("Choose a Bottle spec to upload.");
      return { payload: { bottle: JSON.parse(JSON.stringify(bottle)) }, name: bottle.bottleType || "Community Bottle", map: null, bottle, brand: null };
    }
    if (type === "brand") {
      if (!brand) throw new Error("Choose a Brand / Label spec to upload.");
      return { payload: { brand: JSON.parse(JSON.stringify(brand)) }, name: brand.brand || "Community Brand", map: null, bottle: null, brand };
    }
    if (!map || !bottle || !brand) throw new Error("A Complete Setup requires a Machine Map, Bottle spec, and Brand / Label spec.");
    return {
      payload: { map: JSON.parse(JSON.stringify(map)), bottle: JSON.parse(JSON.stringify(bottle)), brand: JSON.parse(JSON.stringify(brand)) },
      name: `${brand.brand || "Brand"} • ${map.name || "Map"}`,
      map,
      bottle,
      brand
    };
  }

  function refreshUploadSummary(forceName = false) {
    const form = document.getElementById("communityUploadForm");
    const host = document.getElementById("communityUploadSummary");
    if (!form || !host) return;
    updateUploadFieldVisibility();
    try {
      const type = String(form.elements.type?.value || "bundle");
      const current = uploadPackage(type);
      const nameField = form.elements.name;
      const mayReplaceName = forceName || !nameField.value.trim() || nameField.value.trim() === lastSuggestedName;
      if (mayReplaceName) nameField.value = current.name;
      lastSuggestedName = current.name;
      const zone = normalizeCode(form.elements.communityZone?.value || "");
      const site = normalizeCode(form.elements.communitySite?.value || "");
      host.innerHTML = `<strong>${esc(type === "bundle" ? "Complete Setup" : type === "map" ? "Machine Map" : type === "bottle" ? "Bottle" : "Brand / Label")}</strong><div class="sf-community-meta">Map: ${esc(current.map?.name || "—")} • Bottle: ${esc(current.bottle?.bottleType || "—")} • Brand: ${esc(current.brand?.brand || "—")}</div>${zone || site ? `<div class="sf-community-location-line">${zone ? `<span class="sf-community-location-chip">Zone ${esc(zone)}</span>` : ""}${site ? `<span class="sf-community-location-chip">Site ${esc(site)}</span>` : ""}</div>` : ""}`;
    } catch (error) {
      host.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
    }
  }

  async function submitUpload(event) {
    const form = event.currentTarget;
    event.preventDefault();
    event.stopImmediatePropagation();
    const status = document.getElementById("communityUploadStatus");
    if (status) status.textContent = "Preparing configuration…";
    try {
      const type = String(form.elements.type?.value || "bundle");
      const current = uploadPackage(type);
      const source = runtimeState();
      const zone = normalizeCode(form.elements.communityZone?.value || "");
      const site = normalizeCode(form.elements.communitySite?.value || "");
      const validation = library.validationSummary();
      const summary = {
        ...validation,
        communityZone: zone,
        communitySite: site,
        communityLocation: { zone, site }
      };
      const response = await library.api("upload", {
        type,
        name: form.elements.name.value,
        description: form.elements.description.value,
        authorName: form.elements.authorName.value,
        machineType: current.map?.machineType || source?.machineType || "",
        application: current.map?.applicationMode || source?.applicationMode || "",
        brandName: current.brand?.brand || "",
        bottleName: current.bottle?.bottleType || "",
        schemaVersion: 1,
        servoforgeVersion: String(global.SERVOFORGE_RELEASE_VERSION || document.querySelector('meta[name="application-version"]')?.content || ""),
        configPayload: library.sanitize(current.payload),
        validationSummary: summary
      });
      if (status) status.textContent = `Submitted #SF-C${response.package.packageNumber} for review.`;
      form.elements.description.value = "";
      catalogLoaded = false;
      setTimeout(() => document.querySelector('[data-community-tab="mine"]')?.click(), 450);
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  function bindUploadBehavior() {
    const form = document.getElementById("communityUploadForm");
    if (!form || form.dataset.communityV103Bound === "true") return;
    form.dataset.communityV103Bound = "true";
    form.addEventListener("submit", submitUpload, true);
    form.addEventListener("input", (event) => {
      if (event.target?.name === "communityZone" || event.target?.name === "communitySite") {
        event.target.value = normalizeCode(event.target.value);
        refreshUploadSummary(false);
      }
    });
    form.addEventListener("change", (event) => {
      const name = event.target?.name || "";
      if (name === "type") {
        setTimeout(() => refreshUploadSummary(true), 0);
      } else if (["communityMapIndex", "communityBottleIndex", "communityBrandIndex", "communityZone", "communitySite"].includes(name)) {
        setTimeout(() => refreshUploadSummary(false), 0);
      }
    });
  }

  function bindBrowseBehavior() {
    const zone = document.getElementById("communityZoneFilter");
    const site = document.getElementById("communitySiteFilter");
    if (zone && zone.dataset.communityV103Bound !== "true") {
      zone.dataset.communityV103Bound = "true";
      zone.addEventListener("change", applyBrowseLocationFilter);
    }
    if (site && site.dataset.communityV103Bound !== "true") {
      site.dataset.communityV103Bound = "true";
      site.addEventListener("change", applyBrowseLocationFilter);
    }
    const host = document.getElementById("communityBrowseList");
    if (host && host.dataset.communityV103Observed !== "true") {
      host.dataset.communityV103Observed = "true";
      new MutationObserver(() => applyBrowseLocationFilter()).observe(host, { childList: true });
    }
  }

  function bindDialogBehavior() {
    const button = document.getElementById("communityLibraryButton");
    if (button && button.dataset.communityV103Bound !== "true") {
      button.dataset.communityV103Bound = "true";
      button.addEventListener("click", () => {
        ensureBrowseFilters();
        ensureUploadSelectors();
        populateUploadSelectors();
        bindBrowseBehavior();
        bindUploadBehavior();
        loadLocationCatalog(false);
        setTimeout(() => {
          populateUploadSelectors();
          refreshUploadSummary(false);
          applyBrowseLocationFilter();
        }, 0);
      });
    }
    document.querySelector('[data-community-tab="upload"]')?.addEventListener("click", () => {
      populateUploadSelectors();
      setTimeout(() => refreshUploadSummary(false), 0);
    });
  }

  function initialize() {
    ensureStyles();
    ensureBrowseFilters();
    ensureUploadSelectors();
    populateUploadSelectors();
    bindBrowseBehavior();
    bindUploadBehavior();
    bindDialogBehavior();
    loadLocationCatalog(false);
  }

  initialize();

  global.ServoForgeCommunityLibraryV103 = Object.freeze({
    installed: true,
    build: BUILD_MARKER,
    normalizeCode,
    refreshUploadSummary,
    applyBrowseLocationFilter,
    loadLocationCatalog
  });
})(typeof window !== "undefined" ? window : globalThis);
