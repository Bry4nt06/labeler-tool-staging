"use strict";

(function installServoForgeCommunityLibrary(global) {
  if (global.LabelerCommunityLibrary?.installed) return;

  const API_URL = "https://dtdewgbfckwvldceussa.supabase.co/functions/v1/servoforge-community";
  const ADMIN_KEY = "servoforge-feedback-admin-session-v1";
  const BUILD_MARKER = "community-library-metadata-filters-v131-20260911-0010";
  const LEGACY_SETTINGS_ACTIONS = new Set([
    "Export Settings",
    "Import Settings",
    "Download Brands",
    "Import Map JSON",
    "Export JSON",
    "Import Fault Limits",
    "Import Fault JSON",
    "Export CSV"
  ]);

  let activePreview = null;
  let browseItems = [];
  let pendingRpcProgramId = "";

  function runtimeState() {
    try { return typeof state !== "undefined" ? state : global.state; }
    catch { return global.state; }
  }

  function token() {
    if (typeof global.LabelerFeedbackCenter?.token === "function") return global.LabelerFeedbackCenter.token();
    const key = "servoforge-feedback-access-token-v1";
    let value = "";
    try { value = String(global.localStorage?.getItem(key) || ""); } catch { }
    if (value.length >= 20) return value;
    const random = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    value = `sf-${random}-${Math.random()}`;
    try { global.localStorage?.setItem(key, value); } catch { }
    return value;
  }

  function adminKey() {
    try { return String(global.sessionStorage?.getItem(ADMIN_KEY) || ""); } catch { return ""; }
  }

  function setAdminKey(value) {
    try {
      if (value) global.sessionStorage?.setItem(ADMIN_KEY, value);
      else global.sessionStorage?.removeItem(ADMIN_KEY);
    } catch { }
  }

  async function api(action, payload = {}) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: token(), ...payload })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(String(data?.error || `Community request failed (${response.status}).`));
    return data;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function sanitize(value, depth = 0) {
    if (depth > 24) throw new Error("Community configuration is nested too deeply.");
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
    if (Array.isArray(value)) return value.slice(0, 1000).map((item) => sanitize(item, depth + 1));
    if (typeof value !== "object") return null;
    const result = {};
    Object.entries(value).forEach(([key, child]) => {
      if (["__proto__", "prototype", "constructor"].includes(key)) return;
      result[key] = sanitize(child, depth + 1);
    });
    return result;
  }

  function selectedMap() {
    const source = runtimeState();
    if (typeof global.selectedMachineMap === "function") return global.selectedMachineMap();
    return source?.mapLibrary?.find?.((map) => map.id === source.activeMapId) || source?.mapLibrary?.[0] || null;
  }

  function selectedBottle() {
    const source = runtimeState();
    return source?.bottleSpecs?.find?.((row) => String(row?.bottleType || "") === String(source?.selectedBottle || "")) || null;
  }

  function selectedBrand() {
    const source = runtimeState();
    return source?.labelSpecs?.find?.((row) => String(row?.brand || "") === String(source?.selectedBrand || "")) || null;
  }

  function selectedRpcProgram(id = "") {
    const source = runtimeState();
    const programs = Array.isArray(source?.servoProfileLibrary) ? source.servoProfileLibrary : [];
    const selectedId = String(id || pendingRpcProgramId || document.getElementById("communityRpcProgram")?.value || source?.activeServoProfileId || "");
    return programs.find((entry) => entry.id === selectedId) || programs[0] || null;
  }

  function validationSummary() {
    const panel = document.querySelector("#validation, .validation, .validation-panel");
    const text = String(panel?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 800);
    const requirements = global.LabelerSpecificationRequirements;
    const source = runtimeState();
    let specificationIssues = [];
    try { specificationIssues = requirements?.validateState?.(source) || []; } catch { }
    return {
      schemaChecked: true,
      localValidationPass: /Validation PASS/i.test(text) && /Servo Pipeline PASS/i.test(text),
      specificationIssueCount: specificationIssues.length,
      validationText: text
    };
  }

  function currentPackage(type) {
    const map = selectedMap();
    const bottle = selectedBottle();
    const brand = selectedBrand();
    if (type === "map") {
      if (!map) throw new Error("Select a machine map before uploading.");
      return { payload: { map: deepClone(map) }, name: map.name || "Community Map", map, bottle, brand };
    }
    if (type === "bottle") {
      if (!bottle) throw new Error("Select a Bottle Type before uploading.");
      return { payload: { bottle: deepClone(bottle) }, name: bottle.bottleType || "Community Bottle", map, bottle, brand };
    }
    if (type === "brand") {
      if (!brand) throw new Error("Select a Brand before uploading.");
      return { payload: { brand: deepClone(brand) }, name: brand.brand || "Community Brand", map, bottle, brand };
    }
    if (type === "rpc_program") {
      const rpcProgram = selectedRpcProgram();
      if (!rpcProgram) throw new Error("Save or select an RPC program before uploading.");
      return {
        payload: { rpcProgram: deepClone(rpcProgram) },
        name: rpcProgram.name || "Community RPC Program",
        map,
        bottle,
        brand,
        rpcProgram
      };
    }
    throw new Error("Choose a supported Community package type.");
  }

  function statusLabel(status) {
    return ({ pending: "Pending Review", published: "Published", rejected: "Rejected" })[status] || status;
  }

  function typeLabel(type) {
    return ({ map: "Machine Map", bottle: "Bottle", brand: "Brand / Label", bundle: "Complete Setup", rpc_program: "RPC Program" })[type] || type;
  }

  function stars(value, editable = false, packageId = "") {
    const rating = Number(value || 0);
    return `<span class="sf-community-stars" ${packageId ? `data-community-rating="${esc(packageId)}"` : ""}>${[1,2,3,4,5].map((star) => editable
      ? `<button type="button" data-community-star="${star}" class="${star <= rating ? "active" : ""}" aria-label="Rate ${star} out of 5">★</button>`
      : `<span class="${star <= rating ? "active" : ""}">★</span>`).join("")}</span>`;
  }

  function ensureStyles() {
    if (document.getElementById("servoforgeCommunityStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeCommunityStyles";
    style.textContent = `
      .sf-community-top-button{margin-right:8px;white-space:nowrap}
      .sf-community-dialog{width:min(1040px,calc(100vw - 24px));max-height:min(860px,calc(100vh - 30px));padding:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);box-shadow:0 30px 80px rgba(0,0,0,.55)}
      .sf-community-dialog::backdrop{background:rgba(3,8,12,.8);backdrop-filter:blur(3px)}
      .sf-community-shell{display:flex;flex-direction:column;max-height:inherit}.sf-community-head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:var(--panel-hi)}
      .sf-community-head h2{margin:0;font-size:20px}.sf-community-head p{margin:3px 0 0;color:var(--muted);font-size:13px}.sf-community-close{margin-left:auto;background:transparent;box-shadow:none}
      .sf-community-tabs{display:flex;gap:8px;padding:12px 18px 0;flex-wrap:wrap}.sf-community-tabs button{background:var(--input);box-shadow:none}.sf-community-tabs button.active{background:linear-gradient(180deg,var(--btn-hover-a),var(--btn-hover-b))}
      .sf-community-body{padding:18px;overflow:auto}.sf-community-pane[hidden]{display:none!important}.sf-community-toolbar{display:grid;grid-template-columns:1fr 180px auto;gap:8px;margin-bottom:14px}.sf-community-toolbar input,.sf-community-toolbar select,.sf-community-field input,.sf-community-field select,.sf-community-field textarea,.sf-community-admin-status{width:100%;background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:9px}
      .sf-community-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.sf-community-field{display:flex;flex-direction:column;gap:6px}.sf-community-field.full{grid-column:1/-1}.sf-community-field textarea{min-height:95px;resize:vertical}.sf-community-note{font-size:12px;color:var(--muted)}
      .sf-community-list{display:grid;gap:12px}.sf-community-card{border:1px solid var(--line);border-radius:10px;background:var(--bg-soft);padding:14px}.sf-community-card-head{display:flex;gap:10px;align-items:flex-start}.sf-community-card-head h3{margin:0;font-size:16px}.sf-community-meta{font-size:12px;color:var(--muted);margin-top:4px}.sf-community-badge{margin-left:auto;border:1px solid var(--line);border-radius:999px;padding:4px 8px;font-size:11px;white-space:nowrap}.sf-community-description{margin:10px 0;line-height:1.4;white-space:pre-wrap}.sf-community-card-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.sf-community-card-actions button{padding:7px 10px}.sf-community-stars{display:inline-flex;gap:1px;vertical-align:middle}.sf-community-stars span,.sf-community-stars button{border:0;background:none!important;box-shadow:none!important;padding:0 1px;color:#607078;font-size:18px;line-height:1}.sf-community-stars .active{color:#f4bd42}
      .sf-community-rating-editor{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;margin-top:10px}.sf-community-rating-editor input{background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:7px}.sf-community-empty{padding:24px;border:1px dashed var(--line);border-radius:9px;color:var(--muted);text-align:center}.sf-community-status{font-size:13px;color:var(--muted)}
      .sf-community-preview{border:1px solid var(--line);border-radius:10px;padding:14px;margin-top:14px;background:var(--panel-hi)}.sf-community-conflicts{margin:8px 0 0;padding-left:20px}.sf-community-import-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.sf-community-admin-actions{display:grid;grid-template-columns:170px 1fr auto;gap:8px;margin-top:10px}.sf-community-admin-actions input{background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:8px}
      @media(max-width:720px){.sf-community-toolbar,.sf-community-grid,.sf-community-admin-actions,.sf-community-rating-editor{grid-template-columns:1fr}.sf-community-field.full{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function removeLegacySettingsActions() {
    const panel = document.querySelector(".top-settings-panel");
    if (!panel) return false;
    ["exportSettings", "importSettings", "downloadRepositoryBrands", "exportJson", "importFaultConfig", "exportCsv"].forEach((id) => {
      const node = document.getElementById(id);
      if (!node) return;
      const wrapper = node.matches("input[type='file']") ? node.closest("label") : node;
      wrapper?.remove();
    });
    [...panel.querySelectorAll("button,label,a")].forEach((node) => {
      const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
      if (LEGACY_SETTINGS_ACTIONS.has(text)) node.remove();
    });
    const status = document.getElementById("repositoryBrandDownloadStatus");
    if (status) status.remove();
    return true;
  }

  function ensureUi() {
    ensureStyles();
    removeLegacySettingsActions();
    let button = document.getElementById("communityLibraryButton");
    if (!button) {
      button = document.createElement("button");
      button.id = "communityLibraryButton";
      button.type = "button";
      button.className = "sf-community-top-button";
      button.textContent = "Community";
      const feedback = document.getElementById("feedbackCenterButton");
      const settings = document.querySelector(".top-settings-menu");
      const parent = feedback?.parentElement || settings?.parentElement;
      if (parent) parent.insertBefore(button, feedback || settings || null);
    }

    let dialog = document.getElementById("servoforgeCommunityDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "servoforgeCommunityDialog";
      dialog.className = "sf-community-dialog";
      dialog.innerHTML = `
        <div class="sf-community-shell">
          <header class="sf-community-head"><div><h2>ServoForge Community Library</h2><p>Share approved maps, bottles, brands, and RPC programs. No account required.</p></div><button type="button" class="sf-community-close" data-community-close>Close</button></header>
          <nav class="sf-community-tabs" aria-label="Community Library sections"><button type="button" class="active" data-community-tab="browse">Browse</button><button type="button" data-community-tab="upload">Upload</button><button type="button" data-community-tab="mine">My Uploads</button><button type="button" data-community-tab="admin">Community Admin</button></nav>
          <div class="sf-community-body">
            <section class="sf-community-pane" data-community-pane="browse">
              <div class="sf-community-toolbar"><input id="communitySearch" type="search" placeholder="Search maps, brands, bottles, machine types…" /><select id="communityTypeFilter"><option value="">All package types</option><option value="bundle">Complete Setups</option><option value="map">Machine Maps</option><option value="bottle">Bottles</option><option value="brand">Brands / Labels</option><option value="rpc_program">RPC Programs</option></select><button id="communityRefresh" type="button">Refresh</button></div>
              <div id="communityBrowseList" class="sf-community-list"><div class="sf-community-empty">Loading Community Library…</div></div>
              <div id="communityPreviewHost"></div>
            </section>
            <section class="sf-community-pane" data-community-pane="upload" hidden>
              <form id="communityUploadForm">
                <div class="sf-community-grid">
                  <label class="sf-community-field"><span>Package type</span><select name="type"><option value="map">Machine Map</option><option value="bottle">Bottle</option><option value="brand">Brand / Label</option><option value="rpc_program">RPC Program</option></select></label>
                  <label id="communityRpcProgramField" class="sf-community-field" hidden><span>Saved RPC program</span><select id="communityRpcProgram" name="rpcProgramId"></select></label>
                  <label class="sf-community-field"><span>Display name <small>(required)</small></span><input name="authorName" maxlength="60" autocomplete="name" required aria-required="true" /></label>
                  <label class="sf-community-field full"><span>Listing name</span><input name="name" maxlength="160" required /></label>
                  <label class="sf-community-field full"><span>Description</span><textarea name="description" maxlength="600" placeholder="Describe where this setup is used, machine/application notes, or anything another user should know."></textarea></label>
                  <div class="sf-community-field full"><span>Current ServoForge configuration</span><div id="communityUploadSummary" class="sf-community-preview"></div><small class="sf-community-note">Uploads are copied from your current saved configuration and sent for admin review. Community packages contain JSON configuration only—no scripts or executable files.</small></div>
                </div>
                <div class="sf-community-card-actions"><button type="submit">Submit for Review</button><span id="communityUploadStatus" class="sf-community-status" aria-live="polite"></span></div>
              </form>
            </section>
            <section class="sf-community-pane" data-community-pane="mine" hidden><div id="communityMyList" class="sf-community-list"><div class="sf-community-empty">Loading your uploads…</div></div></section>
            <section class="sf-community-pane" data-community-pane="admin" hidden>
              <div id="communityAdminUnlock"><label class="sf-community-field"><span>Community admin key</span><input id="communityAdminKey" type="password" autocomplete="off" placeholder="Use your ServoForge Support Admin key" /></label><div class="sf-community-card-actions"><button id="communityAdminUnlockButton" type="button">Unlock Community Admin</button><span id="communityAdminMessage" class="sf-community-status"></span></div></div>
              <div id="communityAdminPanel" hidden><div class="sf-community-toolbar"><select id="communityAdminFilter"><option value="pending">Pending Review</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="">All</option></select><span></span><button id="communityAdminRefresh" type="button">Refresh</button></div><div id="communityAdminList" class="sf-community-list"></div></div>
            </section>
          </div>
        </div>`;
      document.body.appendChild(dialog);
    }
    return { button, dialog };
  }

  function switchPane(name) {
    document.querySelectorAll("[data-community-tab]").forEach((button) => button.classList.toggle("active", button.dataset.communityTab === name));
    document.querySelectorAll("[data-community-pane]").forEach((pane) => { pane.hidden = pane.dataset.communityPane !== name; });
    if (name === "browse") loadBrowse();
    if (name === "upload") refreshUploadSummary();
    if (name === "mine") loadMine();
    if (name === "admin" && adminKey()) unlockAdmin(adminKey(), true);
  }

  function metadata(item) {
    return [typeLabel(item.type), item.machineType, item.application, item.brandName, item.bottleName].filter(Boolean).join(" • ");
  }

  function metadataTags(item) {
    const summary = item?.validationSummary || {};
    const code = (value) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    const spec = (value) => String(value ?? "").trim().toUpperCase().slice(0, 80);
    return {
      zone: code(item?.zoneCode || summary.communityZone || summary.communityLocation?.zone),
      site: code(item?.siteCode || summary.communitySite || summary.communityLocation?.site),
      specs: [...new Set([
        spec(summary.communityBottleSpecNumber),
        spec(summary.communityBrandSpecNumber)
      ].filter(Boolean))]
    };
  }

  function metadataTagHtml(kind, value, label) {
    return `<button type="button" class="sf-community-location-chip" data-community-tag-filter="${esc(kind)}" data-community-tag-value="${esc(value)}">${esc(label)} ${esc(value)}</button>`;
  }

  function cardHtml(item, mode = "browse") {
    const average = Number(item.ratingAverage || 0);
    const approved = item.status === "published";
    const tags = metadataTags(item);
    const tagLine = [
      tags.zone ? metadataTagHtml("zone", tags.zone, "Zone") : "",
      tags.site ? metadataTagHtml("site", tags.site, "Site") : "",
      ...tags.specs.map((value) => metadataTagHtml("spec", value, "Spec"))
    ].filter(Boolean).join("");
    const ratingEditor = mode === "browse" ? `<div class="sf-community-rating-editor">${stars(item.myRating?.rating || 0, true, item.id)}<input class="sf-community-review" maxlength="200" value="${esc(item.myRating?.review || "")}" placeholder="Optional review (200 characters)" /><button type="button" class="sf-community-save-rating">Save Rating</button></div>` : "";
    const actions = mode === "browse"
      ? `<button type="button" class="sf-community-preview-button">Preview / Import</button>`
      : mode === "mine"
        ? (item.status === "published" ? "" : `<button type="button" class="sf-community-delete-own danger">Delete Upload</button>`)
        : "";
    return `<article class="sf-community-card" data-community-package-id="${esc(item.id)}">
      <div class="sf-community-card-head"><div><h3>#SF-C${esc(item.packageNumber)} · ${esc(item.name)}</h3><div class="sf-community-meta">${esc(metadata(item))}</div></div><span class="sf-community-badge">${esc(statusLabel(item.status))}</span></div>
      ${tagLine ? `<div class="sf-community-location-line" data-community-zone="${esc(tags.zone)}" data-community-site="${esc(tags.site)}" data-community-specs="${esc(tags.specs.join("|"))}">${tagLine}</div>` : ""}
      ${item.description ? `<div class="sf-community-description">${esc(item.description)}</div>` : ""}
      <div class="sf-community-meta">${stars(average)} <strong>${average ? average.toFixed(1) : "No ratings"}</strong>${item.ratingCount ? ` · ${esc(item.ratingCount)} rating${item.ratingCount === 1 ? "" : "s"}` : ""} · ${esc(item.downloadCount || 0)} download${Number(item.downloadCount || 0) === 1 ? "" : "s"}${item.authorName ? ` · Shared by ${esc(item.authorName)}` : ""}${approved ? " · Admin approved" : ""}</div>
      ${item.rejectionReason ? `<div class="notice bad"><strong>Review note</strong><span>${esc(item.rejectionReason)}</span></div>` : ""}
      ${ratingEditor}
      ${actions ? `<div class="sf-community-card-actions">${actions}</div>` : ""}
    </article>`;
  }

  async function loadBrowse() {
    const host = document.getElementById("communityBrowseList");
    if (!host) return;
    host.innerHTML = `<div class="sf-community-empty">Loading Community Library…</div>`;
    try {
      const data = await api("browse", {
        type: document.getElementById("communityTypeFilter")?.value || "",
        search: document.getElementById("communitySearch")?.value || "",
        zone: document.getElementById("communityZoneFilter")?.value || "",
        site: document.getElementById("communitySiteFilter")?.value || "",
        spec: document.getElementById("communitySpecFilter")?.value || ""
      });
      browseItems = Array.isArray(data.packages) ? data.packages : [];
      host.innerHTML = browseItems.length ? browseItems.map((item) => cardHtml(item)).join("") : `<div class="sf-community-empty">No published packages match this search.</div>`;
    } catch (error) { host.innerHTML = `<div class="sf-community-empty">${esc(error.message)}</div>`; }
    finally { global.LabelerCommunityCartIntegration?.decorate?.(); }
  }

  function refreshUploadSummary() {
    const form = document.getElementById("communityUploadForm");
    const host = document.getElementById("communityUploadSummary");
    if (!form || !host) return;
    const rpcField = document.getElementById("communityRpcProgramField");
    const rpcSelect = document.getElementById("communityRpcProgram");
    const rpcMode = form.elements.type.value === "rpc_program";
    if (rpcField) rpcField.hidden = !rpcMode;
    if (rpcSelect && rpcMode) {
      const programs = Array.isArray(runtimeState()?.servoProfileLibrary) ? runtimeState().servoProfileLibrary : [];
      const requested = pendingRpcProgramId || rpcSelect.value || runtimeState()?.activeServoProfileId || "";
      rpcSelect.innerHTML = programs.length
        ? programs.map((entry) => `<option value="${esc(entry.id)}"${entry.id === requested ? " selected" : ""}>${esc(entry.name)}</option>`).join("")
        : '<option value="">No saved RPC programs</option>';
      pendingRpcProgramId = rpcSelect.value || "";
    }
    try {
      const current = currentPackage(form.elements.type.value);
      if (!form.elements.name.value.trim()) form.elements.name.value = current.name;
      host.innerHTML = rpcMode
        ? `<strong>RPC Program</strong><div class="sf-community-meta">Program: ${esc(current.rpcProgram?.name || "—")} • Map: ${esc(current.rpcProgram?.mapName || current.map?.name || "—")} • Brand: ${esc(current.rpcProgram?.brand || current.brand?.brand || "—")} • Bottle: ${esc(current.rpcProgram?.bottleType || current.bottle?.bottleType || "—")}</div>`
        : `<strong>${esc(typeLabel(form.elements.type.value))}</strong><div class="sf-community-meta">Map: ${esc(current.map?.name || "—")} • Bottle: ${esc(current.bottle?.bottleType || "—")} • Brand: ${esc(current.brand?.brand || "—")}</div>`;
    } catch (error) { host.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`; }
  }

  async function submitUpload(form) {
    const status = document.getElementById("communityUploadStatus");
    status.textContent = "Preparing configuration…";
    try {
      const type = form.elements.type.value;
      const current = currentPackage(type);
      const source = runtimeState();
      const summary = validationSummary();
      const response = await api("upload", {
        type,
        name: form.elements.name.value,
        description: form.elements.description.value,
        authorName: form.elements.authorName.value,
        machineType: current.map?.machineType || source?.machineType || "",
        application: current.map?.applicationMode || source?.applicationMode || "",
        brandName: current.rpcProgram?.brand || current.brand?.brand || "",
        bottleName: current.rpcProgram?.bottleType || current.bottle?.bottleType || "",
        schemaVersion: 1,
        servoforgeVersion: String(global.SERVOFORGE_RELEASE_VERSION || document.querySelector('meta[name="application-version"]')?.content || ""),
        configPayload: sanitize(current.payload),
        validationSummary: summary
      });
      status.textContent = `Submitted #SF-C${response.package.packageNumber} for review.`;
      form.elements.description.value = "";
      setTimeout(() => switchPane("mine"), 450);
    } catch (error) { status.textContent = error.message; }
  }

  async function loadMine() {
    const host = document.getElementById("communityMyList");
    if (!host) return;
    host.innerHTML = `<div class="sf-community-empty">Loading your uploads…</div>`;
    try {
      const data = await api("my");
      const items = Array.isArray(data.packages) ? data.packages : [];
      host.innerHTML = items.length ? items.map((item) => cardHtml(item, "mine")).join("") : `<div class="sf-community-empty">You have not submitted a Community package yet.</div>`;
    } catch (error) { host.innerHTML = `<div class="sf-community-empty">${esc(error.message)}</div>`; }
  }

  function conflictsFor(pkg) {
    const source = runtimeState();
    const payload = pkg?.configPayload || {};
    const conflicts = [];
    if (payload.map?.name && source?.mapLibrary?.some?.((row) => row.name === payload.map.name)) conflicts.push(`Map: ${payload.map.name}`);
    if (payload.bottle?.bottleType && source?.bottleSpecs?.some?.((row) => row.bottleType === payload.bottle.bottleType)) conflicts.push(`Bottle: ${payload.bottle.bottleType}`);
    if (payload.brand?.brand && source?.labelSpecs?.some?.((row) => row.brand === payload.brand.brand)) conflicts.push(`Brand: ${payload.brand.brand}`);
    if (payload.rpcProgram?.name && source?.servoProfileLibrary?.some?.((row) => row.name === payload.rpcProgram.name)) conflicts.push(`RPC Program: ${payload.rpcProgram.name}`);
    return conflicts;
  }

  function previewHtml(pkg) {
    const conflicts = conflictsFor(pkg);
    return `<section class="sf-community-preview" data-community-preview-id="${esc(pkg.id)}"><h3>Import Preview · ${esc(pkg.name)}</h3><div class="sf-community-meta">${esc(metadata(pkg))}</div><p>This package will add ${pkg.type === "bundle" ? "a Map, Bottle, and Brand" : `a ${typeLabel(pkg.type)}`} to this browser's local ServoForge workspace.</p>${conflicts.length ? `<strong>Name conflicts detected:</strong><ul class="sf-community-conflicts">${conflicts.map((item) => `<li>${esc(item)}</li>`).join("")}</ul><p class="sf-community-note">Add as New automatically creates unique names. Replace Existing overwrites only matching Map/Bottle/Brand/RPC Program records.</p>` : `<p class="sf-community-note">No matching local configuration names were found.</p>`}<div class="sf-community-import-actions"><button type="button" data-community-import="add">Add as New</button><button type="button" data-community-import="replace" class="secondary-button">Replace Existing</button><button type="button" data-community-import="cancel" class="secondary-button">Cancel</button></div></section>`;
  }

  async function previewPackage(id) {
    const host = document.getElementById("communityPreviewHost");
    if (!host) return;
    host.innerHTML = `<section class="sf-community-preview">Loading package…</section>`;
    try {
      const data = await api("download", { packageId: id });
      activePreview = data.package;
      host.innerHTML = previewHtml(activePreview);
      host.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      loadBrowse();
    } catch (error) { host.innerHTML = `<section class="sf-community-preview notice bad">${esc(error.message)}</section>`; }
  }

  function uniqueName(base, values) {
    const existing = new Set(values.map((value) => String(value || "").toLowerCase()));
    if (!existing.has(String(base || "").toLowerCase())) return base;
    let index = 2;
    let candidate = `${base} (Community)`;
    while (existing.has(candidate.toLowerCase())) candidate = `${base} (Community ${index++})`;
    return candidate;
  }

  function nextNumericId(rows) {
    return Math.max(0, ...(rows || []).map((row) => Number(row?.id)).filter(Number.isFinite)) + 1;
  }

  function normalizeImportedMap(raw, name, id) {
    const map = sanitize(raw);
    map.name = name;
    map.id = id;
    map.locked = false;
    map.protectedDefault = false;
    map.companyDefault = false;
    map.repositoryDefault = false;
    return map;
  }

  function applyPackageToState(pkg, mode, source) {
    const payload = sanitize(pkg?.configPayload || {});
    source.mapLibrary = Array.isArray(source.mapLibrary) ? source.mapLibrary : [];
    source.bottleSpecs = Array.isArray(source.bottleSpecs) ? source.bottleSpecs : [];
    source.labelSpecs = Array.isArray(source.labelSpecs) ? source.labelSpecs : [];
    source.servoProfileLibrary = Array.isArray(source.servoProfileLibrary) ? source.servoProfileLibrary : [];

    if (payload.rpcProgram) {
      const incoming = sanitize(payload.rpcProgram);
      const requestedName = String(incoming.name || pkg.name || "Community RPC Program");
      const index = source.servoProfileLibrary.findIndex((row) => row.name === requestedName);
      if (mode === "replace" && index >= 0) {
        incoming.id = source.servoProfileLibrary[index].id;
        incoming.name = requestedName;
        source.servoProfileLibrary[index] = incoming;
        source.activeServoProfileId = incoming.id;
      } else {
        incoming.name = uniqueName(requestedName, source.servoProfileLibrary.map((row) => row.name));
        incoming.id = `rpc-community-${global.crypto?.randomUUID?.() || Date.now()}`;
        incoming.savedAt = new Date().toISOString();
        source.servoProfileLibrary.push(incoming);
        source.activeServoProfileId = incoming.id;
      }
    }

    let importedBottleName = payload.bottle?.bottleType || "";

    if (payload.map) {
      const requestedName = String(payload.map.name || pkg.name || "Community Map");
      const index = source.mapLibrary.findIndex((row) => row.name === requestedName);
      if (mode === "replace" && index >= 0) {
        source.mapLibrary[index] = normalizeImportedMap(payload.map, requestedName, source.mapLibrary[index].id);
      } else {
        const name = uniqueName(requestedName, source.mapLibrary.map((row) => row.name));
        const id = `community-${global.crypto?.randomUUID?.() || Date.now()}`;
        source.mapLibrary.push(normalizeImportedMap(payload.map, name, id));
      }
    }

    if (payload.bottle) {
      const requestedName = String(payload.bottle.bottleType || "Community Bottle");
      const index = source.bottleSpecs.findIndex((row) => row.bottleType === requestedName);
      if (mode === "replace" && index >= 0) {
        const incoming = sanitize(payload.bottle);
        incoming.id = source.bottleSpecs[index].id;
        incoming.bottleType = requestedName;
        source.bottleSpecs[index] = incoming;
        importedBottleName = requestedName;
      } else {
        const incoming = sanitize(payload.bottle);
        importedBottleName = uniqueName(requestedName, source.bottleSpecs.map((row) => row.bottleType));
        incoming.bottleType = importedBottleName;
        incoming.id = nextNumericId(source.bottleSpecs);
        source.bottleSpecs.push(incoming);
      }
    }

    if (payload.brand) {
      const requestedName = String(payload.brand.brand || "Community Brand");
      const index = source.labelSpecs.findIndex((row) => row.brand === requestedName);
      if (mode === "replace" && index >= 0) {
        const incoming = sanitize(payload.brand);
        incoming.id = source.labelSpecs[index].id;
        incoming.brand = requestedName;
        if (payload.bottle) incoming.bottleType = importedBottleName;
        source.labelSpecs[index] = incoming;
      } else {
        const incoming = sanitize(payload.brand);
        incoming.brand = uniqueName(requestedName, source.labelSpecs.map((row) => row.brand));
        incoming.id = nextNumericId(source.labelSpecs);
        if (payload.bottle) incoming.bottleType = importedBottleName;
        source.labelSpecs.push(incoming);
      }
    }
  }

  function commitImportedState() {
    global.saveCurrentSettings?.();
    global.LabelerLocalPersistenceController?.flush?.();
    global.LabelerWorkspaceActionService?.present?.();
    if (typeof global.render === "function") global.render();
  }

  function importPackage(pkg, mode) {
    const source = runtimeState();
    if (!source) throw new Error("ServoForge workspace state is unavailable.");
    applyPackageToState(pkg, mode, source);
    commitImportedState();
    return true;
  }

  function importPackages(packages, mode = "add") {
    const source = runtimeState();
    if (!source) throw new Error("ServoForge workspace state is unavailable.");
    const list = Array.isArray(packages) ? packages.filter(Boolean) : [];
    if (!list.length) return Object.freeze({ importedCount: 0, mode });

    list.forEach((pkg) => sanitize(pkg?.configPayload || {}));
    const backup = {
      mapLibrary: deepClone(source.mapLibrary),
      bottleSpecs: deepClone(source.bottleSpecs),
      labelSpecs: deepClone(source.labelSpecs),
      servoProfileLibrary: deepClone(source.servoProfileLibrary),
      activeServoProfileId: source.activeServoProfileId
    };

    try {
      list.forEach((pkg) => applyPackageToState(pkg, mode, source));
    } catch (error) {
      source.mapLibrary = backup.mapLibrary;
      source.bottleSpecs = backup.bottleSpecs;
      source.labelSpecs = backup.labelSpecs;
      source.servoProfileLibrary = backup.servoProfileLibrary;
      source.activeServoProfileId = backup.activeServoProfileId;
      throw error;
    }

    commitImportedState();
    return Object.freeze({ importedCount: list.length, mode });
  }

  async function savePackageRating(card) {
    const id = card?.dataset.communityPackageId;
    const group = card?.querySelector("[data-community-rating]");
    const rating = Number(group?.dataset.selectedRating || 0);
    const review = card?.querySelector(".sf-community-review")?.value || "";
    if (!rating) return alert("Choose 1–5 stars first.");
    try { await api("rate", { packageId: id, rating, review }); await loadBrowse(); }
    catch (error) { alert(error.message); }
  }

  async function deleteOwn(card) {
    if (!confirm("Delete this Community submission?")) return;
    try { await api("deleteOwn", { packageId: card.dataset.communityPackageId }); await loadMine(); }
    catch (error) { alert(error.message); }
  }

  async function unlockAdmin(key, silent = false) {
    const message = document.getElementById("communityAdminMessage");
    if (!silent && message) message.textContent = "Checking key…";
    try {
      const data = await api("adminList", { adminKey: key, status: document.getElementById("communityAdminFilter")?.value || "pending" });
      setAdminKey(key);
      document.getElementById("communityAdminUnlock").hidden = true;
      document.getElementById("communityAdminPanel").hidden = false;
      if (message) message.textContent = "";
      renderAdmin(data.packages || []);
    } catch (error) {
      setAdminKey("");
      document.getElementById("communityAdminUnlock").hidden = false;
      document.getElementById("communityAdminPanel").hidden = true;
      if (!silent && message) message.textContent = error.message;
    }
  }

  function renderAdmin(items) {
    const host = document.getElementById("communityAdminList");
    if (!host) return;
    host.innerHTML = items.length ? items.map((item) => `${cardHtml(item, "admin")}<div class="sf-community-admin-actions" data-community-admin-id="${esc(item.id)}"><select class="sf-community-admin-status"><option value="pending" ${item.status === "pending" ? "selected" : ""}>Pending</option><option value="published" ${item.status === "published" ? "selected" : ""}>Publish</option><option value="rejected" ${item.status === "rejected" ? "selected" : ""}>Reject</option></select><input class="sf-community-admin-reason" maxlength="500" value="${esc(item.rejectionReason || "")}" placeholder="Rejection note, if needed" /><button type="button" class="sf-community-admin-save">Apply</button></div>`).join("") : `<div class="sf-community-empty">No packages in this queue.</div>`;
  }

  async function refreshAdmin() {
    const key = adminKey();
    if (!key) return;
    try {
      const data = await api("adminList", { adminKey: key, status: document.getElementById("communityAdminFilter")?.value || "" });
      renderAdmin(data.packages || []);
    } catch (error) { alert(error.message); }
  }

  async function applyAdminStatus(row) {
    try {
      await api("adminStatus", {
        adminKey: adminKey(),
        packageId: row.dataset.communityAdminId,
        status: row.querySelector(".sf-community-admin-status")?.value,
        reason: row.querySelector(".sf-community-admin-reason")?.value || ""
      });
      await refreshAdmin();
    } catch (error) { alert(error.message); }
  }

  function bind() {
    const { button, dialog } = ensureUi();
    const observer = new MutationObserver(removeLegacySettingsActions);
    observer.observe(document.body, { childList: true, subtree: true });

    button?.addEventListener("click", () => { dialog.showModal(); switchPane("browse"); });
    dialog.addEventListener("click", (event) => {
      const tab = event.target.closest?.("[data-community-tab]");
      if (tab) switchPane(tab.dataset.communityTab);
      if (event.target.closest?.("[data-community-close]")) dialog.close();
      const preview = event.target.closest?.(".sf-community-preview-button");
      if (preview) previewPackage(preview.closest(".sf-community-card")?.dataset.communityPackageId);
      const star = event.target.closest?.("[data-community-star]");
      if (star) {
        const group = star.closest("[data-community-rating]");
        const rating = Number(star.dataset.communityStar);
        if (group) {
          group.dataset.selectedRating = String(rating);
          group.querySelectorAll("[data-community-star]").forEach((node) => node.classList.toggle("active", Number(node.dataset.communityStar) <= rating));
        }
      }
      const saveRating = event.target.closest?.(".sf-community-save-rating");
      if (saveRating) savePackageRating(saveRating.closest(".sf-community-card"));
      const deleteButton = event.target.closest?.(".sf-community-delete-own");
      if (deleteButton) deleteOwn(deleteButton.closest(".sf-community-card"));
      const importButton = event.target.closest?.("[data-community-import]");
      if (importButton) {
        const mode = importButton.dataset.communityImport;
        if (mode === "cancel") { activePreview = null; document.getElementById("communityPreviewHost").innerHTML = ""; return; }
        try {
          importPackage(activePreview, mode);
          alert(`Community package imported ${mode === "replace" ? "with matching local records replaced" : "as new local configuration"}.`);
          activePreview = null;
          document.getElementById("communityPreviewHost").innerHTML = "";
        } catch (error) { alert(error.message); }
      }
      const adminSave = event.target.closest?.(".sf-community-admin-save");
      if (adminSave) applyAdminStatus(adminSave.closest("[data-community-admin-id]"));
    });

    document.getElementById("communityRefresh")?.addEventListener("click", loadBrowse);
    document.getElementById("communitySearch")?.addEventListener("input", () => { clearTimeout(global.__sfCommunitySearchTimer); global.__sfCommunitySearchTimer = setTimeout(loadBrowse, 250); });
    document.getElementById("communityTypeFilter")?.addEventListener("change", loadBrowse);
    document.getElementById("communityUploadForm")?.addEventListener("change", (event) => {
      if (event.target?.name === "type") {
        pendingRpcProgramId = "";
        event.currentTarget.elements.name.value = "";
        refreshUploadSummary();
      } else if (event.target?.name === "rpcProgramId") {
        pendingRpcProgramId = event.target.value;
        event.currentTarget.elements.name.value = "";
        refreshUploadSummary();
      }
    });
    document.getElementById("communityUploadForm")?.addEventListener("submit", (event) => { event.preventDefault(); submitUpload(event.currentTarget); });
    document.getElementById("communityAdminUnlockButton")?.addEventListener("click", () => unlockAdmin(document.getElementById("communityAdminKey")?.value || ""));
    document.getElementById("communityAdminRefresh")?.addEventListener("click", refreshAdmin);
    document.getElementById("communityAdminFilter")?.addEventListener("change", refreshAdmin);

    global.addEventListener?.("servoforge:rpc-program-saved", (event) => {
      const profile = event?.detail?.profile;
      if (!profile?.id) return;
      pendingRpcProgramId = profile.id;
      dialog.showModal();
      switchPane("upload");
      const form = document.getElementById("communityUploadForm");
      if (form) {
        form.elements.type.value = "rpc_program";
        form.elements.name.value = profile.name || "";
        form.elements.description.value = profile.description || "";
      }
      refreshUploadSummary();
    });

    removeLegacySettingsActions();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.LabelerCommunityLibrary = Object.freeze({
    installed: true,
    version: 1,
    build: BUILD_MARKER,
    api,
    currentPackage,
    validationSummary,
    sanitize,
    importPackage,
    importPackages,
    removeLegacySettingsActions,
    loadBrowse,
    loadMine,
    selectedRpcProgram
  });
})(typeof window !== "undefined" ? window : globalThis);
