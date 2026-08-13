"use strict";

(function installServoForgeTopActionIcons(global) {
  if (global.LabelerTopActionIcons?.installed) return;

  const BUILD_MARKER = "top-action-icon-cluster-v111-20260813-1936";
  const locationById = new Map();
  let lastSuggestedName = "";

  const icons = Object.freeze({
    community: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
    feedback: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.18.38.5.7.9.9.35.18.75.28 1.15.28H21v4h-.1a1.7 1.7 0 0 0-1.5.82z"></path></svg>'
  });

  const stateNow = () => {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  };
  const code = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  const spec = (value) => String(value ?? "").trim().slice(0, 80);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function ensureStyles() {
    if (document.getElementById("servoforgeTopActionIconStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeTopActionIconStyles";
    style.textContent = `
      .sf-top-action-cluster{margin-left:auto;display:flex;align-items:flex-start;justify-content:flex-end;gap:8px;align-self:flex-start;flex:0 0 auto;position:relative;z-index:1001;pointer-events:auto}
      .sf-top-action-cluster>.sf-top-icon-button,.sf-top-action-cluster>.top-settings-menu>summary{position:relative;width:40px;height:40px;min-width:40px;min-height:40px;margin:0!important;padding:0!important;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:9px;background:linear-gradient(180deg,var(--btn-a),var(--btn-b));color:#ecfff6;cursor:pointer;pointer-events:auto}
      .sf-top-action-cluster svg{width:20px;height:20px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}
      .sf-top-action-cluster>.top-settings-menu{margin:0;align-self:flex-start}.sf-top-action-cluster>.top-settings-menu>summary{list-style:none;text-align:center;font-size:0}.sf-top-action-cluster>.top-settings-menu>summary::-webkit-details-marker{display:none}
      .sf-community-fallback-row{display:grid;grid-template-columns:minmax(0,1fr) 130px;gap:6px;align-items:end}.sf-community-fallback-row input,.sf-community-fallback-row select{width:100%;min-width:0}
      #communityUploadMapField[hidden],#communityUploadBottleField[hidden],#communityUploadBrandField[hidden]{display:none!important}
      @media(max-width:560px){.sf-community-fallback-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function setIconButton(button, icon, label) {
    if (!button) return;
    const unread = button.querySelector("#feedbackUnreadCount");
    button.classList.add("sf-top-icon-button");
    button.title = label;
    button.setAttribute("aria-label", label);
    button.innerHTML = icon;
    if (unread) button.appendChild(unread);
  }

  function addField(grid, before, id, labelText, controlHtml, full = false) {
    let field = document.getElementById(id);
    if (field) return field;
    field = document.createElement("label");
    field.id = id;
    field.className = `sf-community-field${full ? " full" : ""}`;
    field.innerHTML = `<span>${labelText}</span>${controlHtml}`;
    grid.insertBefore(field, before);
    return field;
  }

  function fillSelect(select, rows, label, preferredIndex) {
    if (!select) return;
    const previous = select.dataset.userSelected === "true" ? Number(select.value) : preferredIndex;
    select.innerHTML = rows.length ? rows.map((row, index) => `<option value="${index}">${String(label(row) || "Unnamed")}</option>`).join("") : '<option value="">No saved options available</option>';
    if (rows.length) select.value = String(Number.isInteger(previous) && rows[previous] ? previous : 0);
  }

  function workspace() {
    const source = stateNow();
    const maps = Array.isArray(source?.mapLibrary) ? source.mapLibrary : [];
    const bottles = Array.isArray(source?.bottleSpecs) ? source.bottleSpecs : [];
    const brands = Array.isArray(source?.labelSpecs) ? source.labelSpecs : [];
    return {
      source, maps, bottles, brands,
      mapIndex: Math.max(0, maps.findIndex((row) => String(row?.id) === String(source?.activeMapId))),
      bottleIndex: Math.max(0, bottles.findIndex((row) => String(row?.bottleType || "") === String(source?.selectedBottle || ""))),
      brandIndex: Math.max(0, brands.findIndex((row) => String(row?.brand || "") === String(source?.selectedBrand || "")))
    };
  }

  function selectedRecords() {
    const { maps, bottles, brands } = workspace();
    const index = (id) => Number(document.getElementById(id)?.value);
    return {
      map: maps[index("communityUploadMapSelect")] || null,
      bottle: bottles[index("communityUploadBottleSelect")] || null,
      brand: brands[index("communityUploadBrandSelect")] || null
    };
  }

  function buildPackage(type) {
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
    if (!map || !bottle || !brand) throw new Error("A Complete Setup requires a Machine Map, Bottle spec, and Brand / Label spec.");
    return { payload: { map: clone(map), bottle: clone(bottle), brand: clone(brand) }, name: `${brand.brand || "Brand"} • ${map.name || "Map"}`, map, bottle, brand };
  }

  function updateUploadVisibility() {
    const form = document.getElementById("communityUploadForm");
    if (!form) return;
    const type = form.elements.type?.value || "bundle";
    const visibility = {
      communityUploadMapField: type === "map" || type === "bundle",
      communityUploadBottleField: type === "bottle" || type === "bundle",
      communityUploadBrandField: type === "brand" || type === "bundle"
    };
    Object.entries(visibility).forEach(([id, show]) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.hidden = !show;
      node.style.display = show ? "" : "none";
    });
  }

  function refreshUploadPreview(forceName = false) {
    const form = document.getElementById("communityUploadForm");
    const host = document.getElementById("communityUploadSummary");
    if (!form || !host) return;
    updateUploadVisibility();
    try {
      const current = buildPackage(form.elements.type.value);
      const name = form.elements.name;
      if (forceName || !name.value.trim() || name.value.trim() === lastSuggestedName) name.value = current.name;
      lastSuggestedName = current.name;
      host.innerHTML = `<strong>${form.elements.type.value === "bundle" ? "Complete Setup" : form.elements.type.value === "map" ? "Machine Map" : form.elements.type.value === "bottle" ? "Bottle" : "Brand / Label"}</strong><div class="sf-community-meta">Map: ${current.map?.name || "—"} • Bottle: ${current.bottle?.bottleType || "—"} • Brand: ${current.brand?.brand || "—"}</div>`;
    } catch (error) {
      host.innerHTML = `<div class="notice bad">${error.message}</div>`;
    }
  }

  function populateUploadControls() {
    const { maps, bottles, brands, mapIndex, bottleIndex, brandIndex } = workspace();
    fillSelect(document.getElementById("communityUploadMapSelect"), maps, (row) => row?.name, mapIndex);
    fillSelect(document.getElementById("communityUploadBottleSelect"), bottles, (row) => row?.bottleType, bottleIndex);
    fillSelect(document.getElementById("communityUploadBrandSelect"), brands, (row) => row?.brand, brandIndex);
    refreshUploadPreview(false);
  }

  async function submitFallback(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const form = event.currentTarget;
    const status = document.getElementById("communityUploadStatus");
    try {
      const zone = code(form.elements.communityZone?.value);
      const site = code(form.elements.communitySite?.value);
      if (!zone || !site) throw new Error("Zone and Site are required.");
      const current = buildPackage(form.elements.type.value);
      const library = global.LabelerCommunityLibrary;
      if (!library?.api) throw new Error("Community service is unavailable.");
      const summary = {
        ...(library.validationSummary?.() || {}),
        communityZone: zone,
        communitySite: site,
        communityLocation: { zone, site },
        communityBottleSpecNumber: spec(form.elements.communityBottleSpecNumber?.value),
        communityBrandSpecNumber: spec(form.elements.communityBrandSpecNumber?.value)
      };
      if (status) status.textContent = "Preparing configuration…";
      const result = await library.api("upload", {
        type: form.elements.type.value,
        name: form.elements.name.value,
        description: form.elements.description.value,
        authorName: form.elements.authorName.value,
        machineType: current.map?.machineType || "",
        application: current.map?.applicationMode || "",
        brandName: current.brand?.brand || "",
        bottleName: current.bottle?.bottleType || "",
        schemaVersion: 1,
        servoforgeVersion: String(global.SERVOFORGE_RELEASE_VERSION || "0.9.10"),
        configPayload: library.sanitize ? library.sanitize(current.payload) : current.payload,
        validationSummary: summary
      });
      if (status) status.textContent = `Submitted #SF-C${result.package.packageNumber} for review.`;
      form.elements.description.value = "";
      setTimeout(() => document.querySelector('[data-community-tab="mine"]')?.click(), 450);
    } catch (error) {
      if (status) status.textContent = error.message;
    }
  }

  function ensureCommunityControls() {
    const dialog = document.getElementById("servoforgeCommunityDialog");
    if (!dialog) return false;
    const toolbar = dialog.querySelector('[data-community-pane="browse"] .sf-community-toolbar');
    const typeFilter = document.getElementById("communityTypeFilter");
    if (toolbar && typeFilter) {
      if (!document.getElementById("communityZoneFilter")) {
        const zone = document.createElement("select"); zone.id = "communityZoneFilter"; zone.innerHTML = '<option value="">Zone: All</option>'; toolbar.insertBefore(zone, typeFilter);
      }
      if (!document.getElementById("communitySiteFilter")) {
        const site = document.createElement("select"); site.id = "communitySiteFilter"; site.innerHTML = '<option value="">Site: All</option>'; toolbar.insertBefore(site, typeFilter);
      }
    }

    const form = document.getElementById("communityUploadForm");
    const grid = form?.querySelector(".sf-community-grid");
    const listing = form?.elements?.name?.closest?.(".sf-community-field");
    if (!form || !grid || !listing) return true;

    addField(grid, listing, "communityUploadZoneField", "Zone (required, max 3)", '<input id="communityUploadZone" name="communityZone" maxlength="3" required placeholder="XXX" autocomplete="off" />');
    addField(grid, listing, "communityUploadSiteField", "Site (required, max 3)", '<input id="communityUploadSite" name="communitySite" maxlength="3" required placeholder="XXX" autocomplete="off" />');
    addField(grid, listing, "communityUploadMapField", "Machine Map", '<select id="communityUploadMapSelect" name="communityMapIndex"></select>');
    addField(grid, listing, "communityUploadBottleField", "Bottle spec", '<div class="sf-community-fallback-row"><select id="communityUploadBottleSelect" name="communityBottleIndex"></select><input id="communityUploadBottleSpecNumber" name="communityBottleSpecNumber" maxlength="80" placeholder="Spec #" aria-label="Bottle Spec number" /></div>');
    addField(grid, listing, "communityUploadBrandField", "Brand / Label spec", '<div class="sf-community-fallback-row"><select id="communityUploadBrandSelect" name="communityBrandIndex"></select><input id="communityUploadBrandSpecNumber" name="communityBrandSpecNumber" maxlength="80" placeholder="Spec #" aria-label="Brand or Label Spec number" /></div>');

    if (form.dataset.communityFallbackBound !== "true") {
      form.dataset.communityFallbackBound = "true";
      form.addEventListener("submit", submitFallback, true);
      form.addEventListener("input", (event) => {
        if (["communityZone", "communitySite"].includes(event.target?.name)) event.target.value = code(event.target.value);
      });
      form.addEventListener("change", (event) => {
        if (["communityMapIndex", "communityBottleIndex", "communityBrandIndex"].includes(event.target?.name)) event.target.dataset.userSelected = "true";
        refreshUploadPreview(event.target?.name === "type");
      });
    }
    populateUploadControls();
    return true;
  }

  async function refreshLocationFilters() {
    const library = global.LabelerCommunityLibrary;
    if (!library?.api) return;
    try {
      const data = await library.api("browse", { type: "", search: "" });
      const zones = new Set();
      const sites = new Set();
      locationById.clear();
      for (const item of Array.isArray(data?.packages) ? data.packages : []) {
        const summary = item?.validationSummary || {};
        const zone = code(item?.zoneCode || summary.communityZone || summary.communityLocation?.zone);
        const site = code(item?.siteCode || summary.communitySite || summary.communityLocation?.site);
        locationById.set(String(item.id || ""), { zone, site });
        if (zone) zones.add(zone);
        if (site) sites.add(site);
      }
      const fill = (id, prefix, values) => {
        const select = document.getElementById(id); if (!select) return;
        const current = code(select.value);
        select.innerHTML = `<option value="">${prefix}: All</option>${[...values].sort().map((value) => `<option value="${value}">${prefix} ${value}</option>`).join("")}`;
        if (current && values.has(current)) select.value = current;
      };
      fill("communityZoneFilter", "Zone", zones);
      fill("communitySiteFilter", "Site", sites);
      applyLocationFilter();
    } catch { }
  }

  function applyLocationFilter() {
    const zone = code(document.getElementById("communityZoneFilter")?.value);
    const site = code(document.getElementById("communitySiteFilter")?.value);
    document.querySelectorAll("#communityBrowseList .sf-community-card[data-community-package-id]").forEach((card) => {
      const loc = locationById.get(String(card.dataset.communityPackageId || "")) || { zone: "", site: "" };
      card.hidden = Boolean((zone && loc.zone !== zone) || (site && loc.site !== site));
    });
  }

  function launchCommunity() {
    const launcher = global.ServoForgeCommunityLibraryV104?.openCommunity;
    if (typeof launcher === "function") {
      Promise.resolve(launcher()).then(() => { ensureCommunityControls(); void refreshLocationFilters(); });
      return true;
    }
    const dialog = document.getElementById("servoforgeCommunityDialog");
    if (!dialog) return false;
    try { if (!dialog.open) dialog.showModal(); } catch { dialog.setAttribute("open", ""); }
    dialog.querySelector('[data-community-tab="browse"]')?.click();
    ensureCommunityControls();
    void refreshLocationFilters();
    return true;
  }

  function bindCommunityAction(button) {
    if (!button || button.dataset.communityTopActionV111Bound === "true") return;
    button.dataset.communityTopActionV111Bound = "true";
    button.disabled = false;
    button.removeAttribute("aria-disabled");
    button.style.pointerEvents = "auto";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const launched = launchCommunity();
      if (launched) event.stopImmediatePropagation();
    }, true);
  }

  function apply() {
    const topbar = document.querySelector(".topbar");
    const community = document.getElementById("communityLibraryButton");
    const feedback = document.getElementById("feedbackCenterButton");
    const settings = document.querySelector(".top-settings-menu");
    if (!topbar || !community || !feedback || !settings) return false;

    ensureStyles();
    let cluster = document.getElementById("servoforgeTopActionCluster");
    if (!cluster) {
      cluster = document.createElement("div");
      cluster.id = "servoforgeTopActionCluster";
      cluster.className = "sf-top-action-cluster";
      cluster.setAttribute("aria-label", "Community, Feedback, and Settings");
      topbar.appendChild(cluster);
    }

    setIconButton(community, icons.community, "Community");
    setIconButton(feedback, icons.feedback, "Feedback");
    bindCommunityAction(community);
    ensureCommunityControls();

    const summary = settings.querySelector(":scope > summary");
    if (summary) {
      summary.innerHTML = icons.settings;
      summary.title = "Settings";
      summary.setAttribute("aria-label", "Settings");
    }

    cluster.append(community, feedback, settings);
    return true;
  }

  document.addEventListener("click", (event) => {
    if (event.target?.closest?.('[data-community-tab="upload"]')) setTimeout(() => { ensureCommunityControls(); populateUploadControls(); }, 0);
  });
  document.addEventListener("change", (event) => {
    if (["communityZoneFilter", "communitySiteFilter"].includes(event.target?.id)) applyLocationFilter();
  });

  let attempts = 0;
  function settle() {
    attempts += 1;
    if (apply() || attempts >= 240) return;
    global.setTimeout(settle, 50);
  }

  global.LabelerTopActionIcons = Object.freeze({ installed: true, build: BUILD_MARKER, apply, launchCommunity, ensureCommunityControls, refreshLocationFilters, order: Object.freeze(["community", "feedback", "settings"]) });
  settle();
})(window);