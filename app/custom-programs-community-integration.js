"use strict";

(function installServoForgeCustomProgramsCommunity(global) {
  if (global.ServoForgeCustomProgramsIntegration?.installed) return;

  const FORMAT = "ServoForge Servo Program";
  const EXTENSION = ".sfservo";
  let activePackage = null;
  let searchTimer = null;

  function community() {
    const value = global.LabelerCommunityLibrary;
    if (!value?.installed) throw new Error("Community Library is unavailable.");
    return value;
  }

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

  function programs() {
    const source = runtimeState();
    return Array.isArray(source?.servoProfileLibrary) ? source.servoProfileLibrary : [];
  }

  function activeProgram() {
    const source = runtimeState();
    const id = String(document.getElementById("communityCustomLocalProgram")?.value || source?.activeServoProfileId || "");
    return programs().find((entry) => String(entry?.id) === id) || programs()[0] || null;
  }

  function ensureStyles() {
    if (document.getElementById("servoforgeCustomProgramStyles")) return;
    const style = document.createElement("style");
    style.id = "servoforgeCustomProgramStyles";
    style.textContent = `
      .sf-custom-program-tools{display:grid;grid-template-columns:minmax(220px,1fr) auto auto auto;gap:8px;align-items:end;margin:0 0 14px}
      .sf-custom-program-tools label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted)}
      .sf-custom-program-tools select{width:100%;background:var(--input);color:var(--ink);border:1px solid var(--line);border-radius:7px;padding:9px}
      .sf-custom-program-intro{margin:0 0 12px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--bg-soft);font-size:12px;color:var(--muted)}
      .sf-custom-program-card{border:1px solid var(--line);border-radius:10px;background:var(--bg-soft);padding:14px}
      .sf-custom-program-card h3{margin:0;font-size:16px}.sf-custom-program-card p{margin:8px 0;white-space:pre-wrap}
      @media(max-width:820px){.sf-custom-program-tools{grid-template-columns:1fr 1fr}.sf-custom-program-tools label{grid-column:1/-1}}
    `;
    document.head.appendChild(style);
  }

  function refreshLocalSelector() {
    const select = document.getElementById("communityCustomLocalProgram");
    if (!select) return;
    const source = runtimeState();
    const current = String(select.value || source?.activeServoProfileId || "");
    const rows = programs();
    select.innerHTML = rows.length
      ? rows.map((entry) => `<option value="${esc(entry.id)}"${String(entry.id) === current ? " selected" : ""}>${esc(entry.name || "Unnamed servo program")}</option>`).join("")
      : '<option value="">No local servo programs saved</option>';
  }

  function safeFilename(value) {
    const name = String(value || "servo-program").trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
    return (name || "servo-program").slice(0, 80);
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  function setStatus(message, bad = false) {
    const node = document.getElementById("communityCustomProgramStatus");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.toggle("bad", Boolean(bad));
  }

  function exportLocalProgram() {
    const program = activeProgram();
    if (!program) return setStatus("Save a servo program locally before exporting.", true);
    const envelope = {
      format: FORMAT,
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      servoforgeVersion: String(global.SERVOFORGE_RELEASE_VERSION || ""),
      program: community().sanitize(program)
    };
    downloadFile(`${safeFilename(program.name)}${EXTENSION}`, JSON.stringify(envelope, null, 2));
    setStatus(`Exported ${program.name} for person-to-person sharing.`);
  }

  function validateImportedProgram(value) {
    if (!value || value.format !== FORMAT || Number(value.formatVersion) !== 1) {
      throw new Error("This is not a supported ServoForge .sfservo file.");
    }
    const program = community().sanitize(value.program);
    if (!program || typeof program !== "object") throw new Error("The .sfservo file does not contain a servo program.");
    if (!String(program.name || "").trim()) throw new Error("The servo program is missing a name.");
    const simulation = program.simulation;
    if (!simulation || typeof simulation !== "object" || !Array.isArray(simulation.lines) || !Array.isArray(simulation.turns) || !Array.isArray(simulation.rows) || !Array.isArray(simulation.deletedRows)) {
      throw new Error("The servo program simulation data is incomplete.");
    }
    if ([simulation.lines, simulation.turns, simulation.rows, simulation.deletedRows].some((rows) => rows.length > 1000)) {
      throw new Error("The servo program contains too many simulation rows.");
    }
    return program;
  }

  async function importLocalFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const program = validateImportedProgram(JSON.parse(text));
      community().importPackage({
        id: "local-sfservo-import",
        type: "rpc_program",
        name: program.name,
        configPayload: { rpcProgram: program }
      }, "add");
      refreshLocalSelector();
      setStatus(`Imported ${program.name} into your local ServoForge program library.`);
    } catch (error) {
      setStatus(error?.message || "Unable to import this servo program.", true);
    }
  }

  function shareSelected() {
    const program = activeProgram();
    if (!program) return setStatus("Select a local servo program before sharing.", true);
    global.dispatchEvent?.(new CustomEvent("servoforge:rpc-program-saved", {
      detail: { profile: JSON.parse(JSON.stringify(program)) }
    }));
  }

  function metadata(item) {
    return [item.machineType, item.application, item.brandName, item.bottleName].filter(Boolean).join(" • ");
  }

  function cardHtml(item) {
    const average = Number(item.ratingAverage || 0);
    return `<article class="sf-custom-program-card" data-custom-program-id="${esc(item.id)}">
      <div class="sf-community-card-head"><div><h3>#SF-C${esc(item.packageNumber)} · ${esc(item.name)}</h3><div class="sf-community-meta">Custom Servo Program${metadata(item) ? " • " + esc(metadata(item)) : ""}</div></div><span class="sf-community-badge">Published</span></div>
      ${item.description ? `<p>${esc(item.description)}</p>` : ""}
      <div class="sf-community-meta">${average ? average.toFixed(1) + " ★" : "No ratings"} · ${esc(item.downloadCount || 0)} download${Number(item.downloadCount || 0) === 1 ? "" : "s"}${item.authorName ? " · Shared by " + esc(item.authorName) : ""}</div>
      <div class="sf-community-card-actions"><button type="button" data-custom-program-preview>Preview / Import</button><button type="button" class="secondary-button" data-custom-program-download>Download .sfservo</button></div>
    </article>`;
  }

  async function loadCommunityPrograms() {
    ensureStyles();
    refreshLocalSelector();
    const host = document.getElementById("communityCustomProgramList");
    if (!host) return;
    host.innerHTML = '<div class="sf-community-empty">Loading custom servo programs…</div>';
    try {
      const data = await community().api("browse", {
        type: "rpc_program",
        search: document.getElementById("communityCustomProgramSearch")?.value || ""
      });
      const items = (Array.isArray(data?.packages) ? data.packages : []).filter((item) => item?.type === "rpc_program");
      host.innerHTML = items.length ? items.map(cardHtml).join("") : '<div class="sf-community-empty">No published custom servo programs match this search.</div>';
    } catch (error) {
      host.innerHTML = `<div class="sf-community-empty">${esc(error?.message || "Unable to load custom programs.")}</div>`;
    }
  }

  async function fetchPackage(card) {
    const id = card?.dataset.customProgramId;
    if (!id) throw new Error("Custom program ID is unavailable.");
    const data = await community().api("download", { packageId: id });
    if (data?.package?.type !== "rpc_program" || !data?.package?.configPayload?.rpcProgram) throw new Error("This Community item is not a custom servo program.");
    return data.package;
  }

  async function preview(card) {
    const host = document.getElementById("communityCustomProgramPreview");
    if (!host) return;
    host.innerHTML = '<section class="sf-community-preview">Loading program…</section>';
    try {
      activePackage = await fetchPackage(card);
      const program = activePackage.configPayload.rpcProgram;
      const simulation = program.simulation || {};
      host.innerHTML = `<section class="sf-community-preview"><h3>Import Preview · ${esc(activePackage.name)}</h3>
        <div class="sf-community-meta">${esc(metadata(activePackage))}</div>
        <p>This custom servo program contains ${Number(simulation.lines?.length || 0)} simulation line(s) and will be added to your local RPC Program Library.</p>
        <div class="sf-community-import-actions"><button type="button" data-custom-program-import="add">Add as New</button><button type="button" class="secondary-button" data-custom-program-import="replace">Replace Matching Name</button><button type="button" class="secondary-button" data-custom-program-import="cancel">Cancel</button></div></section>`;
    } catch (error) {
      host.innerHTML = `<section class="sf-community-preview notice bad">${esc(error?.message || "Unable to preview this program.")}</section>`;
    }
  }

  async function downloadCommunityProgram(card) {
    try {
      const pkg = await fetchPackage(card);
      const program = community().sanitize(pkg.configPayload.rpcProgram);
      const envelope = {
        format: FORMAT,
        formatVersion: 1,
        exportedAt: new Date().toISOString(),
        servoforgeVersion: String(global.SERVOFORGE_RELEASE_VERSION || ""),
        community: { packageNumber: pkg.packageNumber, packageId: pkg.id },
        program
      };
      downloadFile(`${safeFilename(program.name || pkg.name)}${EXTENSION}`, JSON.stringify(envelope, null, 2));
      setStatus(`Downloaded ${program.name || pkg.name} as a portable .sfservo file.`);
    } catch (error) {
      setStatus(error?.message || "Unable to download this program.", true);
    }
  }

  function importPreview(mode) {
    const host = document.getElementById("communityCustomProgramPreview");
    if (mode === "cancel") {
      activePackage = null;
      if (host) host.innerHTML = "";
      return;
    }
    if (!activePackage) return;
    try {
      community().importPackage(activePackage, mode === "replace" ? "replace" : "add");
      refreshLocalSelector();
      setStatus(`Imported ${activePackage.name} into your local program library.`);
      activePackage = null;
      if (host) host.innerHTML = "";
    } catch (error) {
      setStatus(error?.message || "Unable to import this program.", true);
    }
  }

  function bind() {
    ensureStyles();
    refreshLocalSelector();
    const dialog = document.getElementById("servoforgeCommunityDialog");
    if (!dialog) return;

    dialog.addEventListener("click", (event) => {
      if (event.target.closest?.('[data-community-tab="custom-programs"]')) setTimeout(loadCommunityPrograms, 0);
      const previewButton = event.target.closest?.("[data-custom-program-preview]");
      if (previewButton) preview(previewButton.closest("[data-custom-program-id]"));
      const downloadButton = event.target.closest?.("[data-custom-program-download]");
      if (downloadButton) downloadCommunityProgram(downloadButton.closest("[data-custom-program-id]"));
      const importButton = event.target.closest?.("[data-custom-program-import]");
      if (importButton) importPreview(importButton.dataset.customProgramImport);
      if (event.target.closest?.("#communityCustomExport")) exportLocalProgram();
      if (event.target.closest?.("#communityCustomImportButton")) document.getElementById("communityCustomImportFile")?.click();
      if (event.target.closest?.("#communityCustomShare")) shareSelected();
    });

    document.getElementById("communityCustomImportFile")?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      importLocalFile(file);
    });
    document.getElementById("communityCustomProgramRefresh")?.addEventListener("click", loadCommunityPrograms);
    document.getElementById("communityCustomProgramSearch")?.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(loadCommunityPrograms, 250);
    });
    global.addEventListener?.("servoforge:rpc-program-saved", refreshLocalSelector);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  global.ServoForgeCustomProgramsIntegration = Object.freeze({
    installed: true,
    version: 1,
    format: FORMAT,
    extension: EXTENSION,
    loadCommunityPrograms,
    refreshLocalSelector,
    validateImportedProgram
  });
})(typeof window !== "undefined" ? window : globalThis);
