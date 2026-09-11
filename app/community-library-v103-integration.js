"use strict";

(function installServoForgeCommunityLibraryV103(global) {
  if (global.ServoForgeCommunityLibraryV103?.installed) return;
  const library = global.LabelerCommunityLibrary;
  if (!library?.installed) return;

  const BUILD = "community-zone-site-spec-filter-v131-20260911-0010";
  const metadataById = new Map();
  let lastSuggestedName = "";

  const stateNow = () => {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  };
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
  const code = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const spec = (value) => String(value ?? "").trim().toUpperCase().slice(0, 80);
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function installStyles() {
    if (document.getElementById("servoforgeCommunityV103Styles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeCommunityV103Styles";
    style.textContent = `
      .sf-community-dialog{width:min(980px,calc(100vw - 24px));max-height:min(790px,calc(100vh - 24px))}
      .sf-community-head{padding:10px 14px;gap:8px}.sf-community-head h2{font-size:16px}.sf-community-head p{font-size:11px;margin:2px 0 0}.sf-community-close{padding:6px 9px;font-size:12px}
      .sf-community-tabs{gap:6px;padding:8px 14px 0}.sf-community-tabs button{padding:6px 9px;font-size:12px}.sf-community-body{padding:12px}
      .sf-community-toolbar{grid-template-columns:minmax(220px,1fr) 108px 108px 132px 150px auto;gap:6px;margin-bottom:9px}.sf-community-toolbar input,.sf-community-toolbar select{padding:7px 8px;font-size:12px}
      .sf-community-list{gap:8px}.sf-community-card{padding:9px 10px;border-radius:8px}.sf-community-card-head{gap:7px}.sf-community-card-head h3{font-size:13px;line-height:1.2}.sf-community-badge{font-size:9.5px;padding:2px 6px}
      .sf-community-meta{font-size:10.5px;margin-top:2px;line-height:1.25}.sf-community-description{font-size:11px;margin:6px 0;line-height:1.3}.sf-community-stars span,.sf-community-stars button{font-size:14px}
      .sf-community-rating-editor{grid-template-columns:auto minmax(180px,1fr) auto;gap:6px;margin-top:6px}.sf-community-rating-editor input{padding:5px 7px;font-size:11px}.sf-community-rating-editor button,.sf-community-card-actions button{padding:5px 8px;font-size:11px}.sf-community-card-actions{gap:6px;margin-top:6px}
      .sf-community-grid{gap:8px}.sf-community-field{gap:4px;font-size:12px}.sf-community-field input,.sf-community-field select,.sf-community-field textarea{padding:7px 8px;font-size:12px}.sf-community-field textarea{min-height:70px}.sf-community-preview{padding:9px;margin-top:8px;font-size:11px}.sf-community-note,.sf-community-status{font-size:10.5px}
      .sf-community-location-line{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px}.sf-community-location-chip{display:inline-flex;appearance:none;border:1px solid var(--line);border-radius:999px;padding:2px 6px;font:inherit;font-size:9.5px;line-height:1.2;color:var(--muted);background:var(--input);box-shadow:none;cursor:pointer}.sf-community-location-chip:hover,.sf-community-location-chip:focus-visible{color:var(--ink);border-color:var(--accent)}
      .sf-community-upload-selector[hidden]{display:none!important}
      @media(max-width:820px){.sf-community-toolbar{grid-template-columns:1fr 1fr}.sf-community-toolbar #communitySearch{grid-column:1/-1}.sf-community-toolbar #communityRefresh{grid-column:1/-1}.sf-community-rating-editor{grid-template-columns:1fr}}
      @media(max-width:560px){.sf-community-toolbar{grid-template-columns:1fr}.sf-community-toolbar #communitySearch,.sf-community-toolbar #communityRefresh{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function installBrowseControls() {
    const toolbar = document.querySelector('[data-community-pane="browse"] .sf-community-toolbar');
    const type = document.getElementById("communityTypeFilter");
    if (!toolbar || !type) return;
    if (!document.getElementById("communityZoneFilter")) {
      const select = document.createElement("select");
      select.id = "communityZoneFilter";
      select.setAttribute("aria-label", "Community zone filter");
      select.innerHTML = '<option value="">Zone: All</option>';
      toolbar.insertBefore(select, type);
    }
    if (!document.getElementById("communitySiteFilter")) {
      const select = document.createElement("select");
      select.id = "communitySiteFilter";
      select.setAttribute("aria-label", "Community site filter");
      select.innerHTML = '<option value="">Site: All</option>';
      toolbar.insertBefore(select, type);
    }
    if (!document.getElementById("communitySpecFilter")) {
      const select = document.createElement("select");
      select.id = "communitySpecFilter";
      select.setAttribute("aria-label", "Community spec filter");
      select.innerHTML = '<option value="">Spec: All</option>';
      toolbar.insertBefore(select, type);
    }
  }

  function locationOf(item) {
    const summary = item?.validationSummary || {};
    return {
      zone: code(item?.zoneCode || summary.communityZone || summary.communityLocation?.zone),
      site: code(item?.siteCode || summary.communitySite || summary.communityLocation?.site),
      specs: [...new Set([
        spec(summary.communityBottleSpecNumber),
        spec(summary.communityBrandSpecNumber)
      ].filter(Boolean))]
    };
  }

  function setFilterOptions(id, prefix, values, normalize = code) {
    const select = document.getElementById(id);
    if (!select) return;
    const selected = normalize(select.value);
    const sorted = [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    select.innerHTML = `<option value="">${prefix}: All</option>${sorted.map((value) => `<option value="${esc(value)}">${prefix} ${esc(value)}</option>`).join("")}`;
    if (selected && values.has(selected)) select.value = selected;
  }

  async function refreshLocationCatalog() {
    try {
      const data = await library.api("browse", { type: "", search: "" });
      const items = Array.isArray(data?.packages) ? data.packages : [];
      const zones = new Set();
      const sites = new Set();
      const specs = new Set();
      metadataById.clear();
      items.forEach((item) => {
        const loc = locationOf(item);
        metadataById.set(String(item.id || ""), loc);
        if (loc.zone) zones.add(loc.zone);
        if (loc.site) sites.add(loc.site);
        loc.specs.forEach((value) => specs.add(value));
      });
      setFilterOptions("communityZoneFilter", "Zone", zones);
      setFilterOptions("communitySiteFilter", "Site", sites);
      setFilterOptions("communitySpecFilter", "Spec", specs, spec);
      applyLocationFilter();
    } catch {
      // Base Community UI owns API error presentation.
    }
  }

  function annotateCard(card, loc) {
    const zone = code(loc?.zone);
    const site = code(loc?.site);
    const specs = Array.isArray(loc?.specs) ? loc.specs.map(spec).filter(Boolean) : [];
    const existing = card.querySelector(".sf-community-location-line");
    if (!zone && !site && !specs.length) {
      existing?.remove();
      return;
    }
    if (existing?.dataset?.communityZone === zone && existing?.dataset?.communitySite === site && existing?.dataset?.communitySpecs === specs.join("|")) return;
    const head = card.querySelector(".sf-community-card-head");
    if (!head) return;
    const line = existing || document.createElement("div");
    line.className = "sf-community-location-line";
    line.dataset.communityZone = zone;
    line.dataset.communitySite = site;
    line.dataset.communitySpecs = specs.join("|");
    line.innerHTML = `${zone ? `<button type="button" class="sf-community-location-chip" data-community-tag-filter="zone" data-community-tag-value="${esc(zone)}">Zone ${esc(zone)}</button>` : ""}${site ? `<button type="button" class="sf-community-location-chip" data-community-tag-filter="site" data-community-tag-value="${esc(site)}">Site ${esc(site)}</button>` : ""}${specs.map((value) => `<button type="button" class="sf-community-location-chip" data-community-tag-filter="spec" data-community-tag-value="${esc(value)}">Spec ${esc(value)}</button>`).join("")}`;
    if (!existing) head.insertAdjacentElement("afterend", line);
  }

  function applyLocationFilter() {
    const host = document.getElementById("communityBrowseList");
    if (!host) return;
    const zone = code(document.getElementById("communityZoneFilter")?.value);
    const site = code(document.getElementById("communitySiteFilter")?.value);
    const selectedSpec = spec(document.getElementById("communitySpecFilter")?.value);
    const cards = [...host.querySelectorAll(".sf-community-card[data-community-package-id]")];
    let visible = 0;
    cards.forEach((card) => {
      const loc = metadataById.get(String(card.dataset.communityPackageId || "")) || { zone: "", site: "", specs: [] };
      annotateCard(card, loc);
      const show = (!zone || loc.zone === zone) && (!site || loc.site === site) && (!selectedSpec || loc.specs.includes(selectedSpec));
      card.hidden = !show;
      if (show) visible += 1;
    });
    let empty = document.getElementById("communityLocationFilterEmpty");
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "communityLocationFilterEmpty";
      empty.className = "sf-community-empty";
      host.appendChild(empty);
    }
    empty.textContent = "No published packages match the selected Zone, Site, and Spec filters.";
    empty.hidden = !(cards.length && !visible);
  }

  function installUploadControls() {
    const form = document.getElementById("communityUploadForm");
    const grid = form?.querySelector(".sf-community-grid");
    const listing = form?.elements?.name?.closest?.(".sf-community-field");
    if (!form || !grid || !listing) return;
    const add = (id, html) => {
      if (document.getElementById(id)) return;
      const label = document.createElement("label");
      label.id = id;
      label.className = "sf-community-field";
      label.innerHTML = html;
      grid.insertBefore(label, listing);
    };
    add("communityUploadZoneField", '<span>Zone <small>(required, 2–3)</small></span><input id="communityUploadZone" name="communityZone" minlength="2" maxlength="3" pattern="[A-Z0-9]{2,3}" required aria-required="true" autocomplete="off" placeholder="XX" />');
    add("communityUploadSiteField", '<span>Site <small>(required, 2–3)</small></span><input id="communityUploadSite" name="communitySite" minlength="2" maxlength="3" pattern="[A-Z0-9]{2,3}" required aria-required="true" autocomplete="off" placeholder="XX" />');
    add("communityUploadMapField", '<span>Machine Map</span><select id="communityUploadMapSelect" name="communityMapIndex"></select>');
    add("communityUploadBottleField", '<span>Bottle spec</span><select id="communityUploadBottleSelect" name="communityBottleIndex"></select>');
    add("communityUploadBrandField", '<span>Brand / Label spec</span><select id="communityUploadBrandSelect" name="communityBrandIndex"></select>');
    ["communityUploadMapField", "communityUploadBottleField", "communityUploadBrandField"].forEach((id) => document.getElementById(id)?.classList.add("sf-community-upload-selector"));
    const note = document.getElementById("communityUploadSummary")?.nextElementSibling;
    if (note?.classList.contains("sf-community-note")) note.textContent = "Choose from the Maps, Bottle specs, and Brand / Label specs already saved in this ServoForge workspace. Uploads are copied and sent for admin review.";
  }

  function currentWorkspaceDefaults() {
    const source = stateNow();
    const maps = Array.isArray(source?.mapLibrary) ? source.mapLibrary : [];
    const bottles = Array.isArray(source?.bottleSpecs) ? source.bottleSpecs : [];
    const brands = Array.isArray(source?.labelSpecs) ? source.labelSpecs : [];
    const mapIndex = Math.max(0, maps.findIndex((row) => String(row?.id) === String(source?.activeMapId)));
    const bottleIndex = Math.max(0, bottles.findIndex((row) => String(row?.bottleType || "") === String(source?.selectedBottle || "")));
    const brandIndex = Math.max(0, brands.findIndex((row) => String(row?.brand || "") === String(source?.selectedBrand || "")));
    return { source, maps, bottles, brands, mapIndex, bottleIndex, brandIndex };
  }

  function fillSelect(id, rows, label, preferred) {
    const select = document.getElementById(id);
    if (!select) return;
    const previous = select.dataset.userSelected === "true" ? Number(select.value) : preferred;
    select.innerHTML = rows.length ? rows.map((row, index) => `<option value="${index}">${esc(label(row))}</option>`).join("") : '<option value="">No saved options available</option>';
    if (rows.length) select.value = String(Number.isInteger(previous) && rows[previous] ? previous : 0);
  }

  function populateUploadControls() {
    installUploadControls();
    const { maps, bottles, brands, mapIndex, bottleIndex, brandIndex } = currentWorkspaceDefaults();
    fillSelect("communityUploadMapSelect", maps, (row) => row?.name || "Unnamed map", mapIndex);
    fillSelect("communityUploadBottleSelect", bottles, (row) => row?.bottleType || "Unnamed bottle", bottleIndex);
    fillSelect("communityUploadBrandSelect", brands, (row) => row?.brand || "Unnamed brand", brandIndex);
    updateUploadVisibility();
  }

  function updateUploadVisibility() {
    const type = document.getElementById("communityUploadForm")?.elements?.type?.value || "map";
    const visible = {
      communityUploadMapField: type === "map",
      communityUploadBottleField: type === "bottle",
      communityUploadBrandField: type === "brand"
    };
    Object.entries(visible).forEach(([id, show]) => { const node = document.getElementById(id); if (node) node.hidden = !show; });
  }

  function selectedRecords() {
    const { maps, bottles, brands } = currentWorkspaceDefaults();
    const index = (id) => Number(document.getElementById(id)?.value);
    return {
      map: maps[index("communityUploadMapSelect")] || null,
      bottle: bottles[index("communityUploadBottleSelect")] || null,
      brand: brands[index("communityUploadBrandSelect")] || null
    };
  }

  function buildUploadPackage(type) {
    const { map, bottle, brand } = selectedRecords();
    if (type === "map") {
      if (!map) throw new Error("Choose a Machine Map to upload.");
      return { payload: { map: clone(map) }, name: map.name || "Community Map", map, bottle: null, brand: null };
    }
    if (type === "bottle") {
      if (!bottle) throw new Error("Choose a Bottle spec to upload.");
      return { payload: { bottle: clone(bottle) }, name: bottle.bottleType || "Community Bottle", map: null, bottle, brand: null };
    }
    if (type === "brand") {
      if (!brand) throw new Error("Choose a Brand / Label spec to upload.");
      return { payload: { brand: clone(brand) }, name: brand.brand || "Community Brand", map: null, bottle: null, brand };
    }
    if (type === "rpc_program") return library.currentPackage(type);
    throw new Error("Choose a supported Community package type.");
  }

  function refreshUploadPreview(forceName = false) {
    const form = document.getElementById("communityUploadForm");
    const host = document.getElementById("communityUploadSummary");
    if (!form || !host) return;
    updateUploadVisibility();
    try {
      const type = form.elements.type.value;
      const current = buildUploadPackage(type);
      const name = form.elements.name;
      if (forceName || !name.value.trim() || name.value.trim() === lastSuggestedName) name.value = current.name;
      lastSuggestedName = current.name;
      const zone = code(form.elements.communityZone?.value);
      const site = code(form.elements.communitySite?.value);
      host.innerHTML = `<strong>${type === "map" ? "Machine Map" : type === "bottle" ? "Bottle" : type === "brand" ? "Brand / Label" : "RPC Program"}</strong><div class="sf-community-meta">Map: ${esc(current.map?.name || "—")} • Bottle: ${esc(current.bottle?.bottleType || "—")} • Brand: ${esc(current.brand?.brand || "—")}</div>${zone || site ? `<div class="sf-community-location-line">${zone ? `<span class="sf-community-location-chip">Zone ${esc(zone)}</span>` : ""}${site ? `<span class="sf-community-location-chip">Site ${esc(site)}</span>` : ""}</div>` : ""}`;
    } catch (error) {
      host.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
    }
  }

  async function submitSelectedPackage(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    const status = document.getElementById("communityUploadStatus");
    if (status) status.textContent = "Preparing configuration…";
    try {
      const type = form.elements.type.value;
      const current = buildUploadPackage(type);
      const source = stateNow();
      const zone = code(form.elements.communityZone?.value);
      const site = code(form.elements.communitySite?.value);
      const bottleSpecNumber = String(form.elements.communityBottleSpecNumber?.value || "").trim().slice(0, 80);
      const brandSpecNumber = String(form.elements.communityBrandSpecNumber?.value || "").trim().slice(0, 80);
      const authorName = String(form.elements.authorName?.value || "").trim();
      if (!authorName) throw new Error("Display Name is required.");
      if (zone.length < 2 || site.length < 2) throw new Error("Zone and Site must be 2–3 characters.");
      const validationSummary = {
        ...library.validationSummary(),
        communityZone: zone,
        communitySite: site,
        communityLocation: { zone, site },
        communityBottleSpecNumber: bottleSpecNumber,
        communityBrandSpecNumber: brandSpecNumber
      };
      const result = await library.api("upload", {
        type,
        name: form.elements.name.value,
        description: form.elements.description.value,
        authorName,
        machineType: current.map?.machineType || source?.machineType || "",
        application: current.map?.applicationMode || source?.applicationMode || "",
        brandName: current.brand?.brand || "",
        bottleName: current.bottle?.bottleType || "",
        schemaVersion: 1,
        servoforgeVersion: String(global.SERVOFORGE_RELEASE_VERSION || document.querySelector('meta[name="application-version"]')?.content || ""),
        configPayload: library.sanitize(current.payload),
        validationSummary
      });
      if (status) status.textContent = `Submitted #SF-C${result.package.packageNumber} for review.`;
      form.elements.description.value = "";
      setTimeout(() => document.querySelector('[data-community-tab="mine"]')?.click(), 450);
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  function bind() {
    installStyles();
    installBrowseControls();
    installUploadControls();
    populateUploadControls();

    const form = document.getElementById("communityUploadForm");
    if (form && form.dataset.communityV103Bound !== "true") {
      form.dataset.communityV103Bound = "true";
      form.addEventListener("submit", submitSelectedPackage, true);
      form.addEventListener("input", (event) => {
        if (["communityZone", "communitySite"].includes(event.target?.name)) {
          event.target.value = code(event.target.value);
          refreshUploadPreview(false);
        }
      });
      form.addEventListener("change", (event) => {
        if (["communityMapIndex", "communityBottleIndex", "communityBrandIndex"].includes(event.target?.name)) event.target.dataset.userSelected = "true";
        setTimeout(() => refreshUploadPreview(event.target?.name === "type"), 0);
      });
    }

    ["communityZoneFilter", "communitySiteFilter", "communitySpecFilter"].forEach((id) => document.getElementById(id)?.addEventListener("change", () => {
      void library.loadBrowse();
    }));
    document.addEventListener("click", (event) => {
      const chip = event.target?.closest?.("[data-community-tag-filter]");
      if (!chip) return;
      const id = ({ zone: "communityZoneFilter", site: "communitySiteFilter", spec: "communitySpecFilter" })[chip.dataset.communityTagFilter];
      const select = id ? document.getElementById(id) : null;
      if (!select) return;
      select.value = chip.dataset.communityTagValue || "";
      void library.loadBrowse();
    });
    document.getElementById("communityRefresh")?.addEventListener("click", () => setTimeout(refreshLocationCatalog, 0));
    document.querySelector('[data-community-tab="upload"]')?.addEventListener("click", () => {
      populateUploadControls();
      setTimeout(() => refreshUploadPreview(false), 0);
    });
    document.getElementById("communityLibraryButton")?.addEventListener("click", () => {
      populateUploadControls();
      refreshLocationCatalog();
      setTimeout(() => refreshUploadPreview(false), 0);
    });

    const browseHost = document.getElementById("communityBrowseList");
    if (browseHost) new MutationObserver(applyLocationFilter).observe(browseHost, { childList: true });
    refreshLocationCatalog();
    refreshUploadPreview(false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.ServoForgeCommunityLibraryV103 = Object.freeze({ installed: true, build: BUILD, normalizeCode: code, refreshLocationCatalog, applyLocationFilter, refreshUploadPreview, idempotentLocationAnnotationV129: true });
})(typeof window !== "undefined" ? window : globalThis);
