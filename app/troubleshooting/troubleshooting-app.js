"use strict";

(function startServoForgeTroubleshooting(global) {
  const library = global.ServoForgeTroubleshootingLibrary;
  if (!library) throw new Error("ServoForge troubleshooting library is unavailable.");

  const STORAGE_KEY = "labelerToolSettings";
  const SESSION_KEY = "servoforge-troubleshooting-session-v1";
  const state = {
    context: readServoForgeContext(),
    flowId: "",
    nodeId: "",
    history: [],
    resultId: "",
    query: ""
  };

  const els = {
    context: document.getElementById("troubleshootingContext"),
    search: document.getElementById("faultSearch"),
    searchButton: document.getElementById("faultSearchButton"),
    results: document.getElementById("searchResults"),
    guideCards: document.getElementById("guideCards"),
    workspace: document.getElementById("diagnosticWorkspace"),
    breadcrumb: document.getElementById("diagnosticBreadcrumb"),
    question: document.getElementById("diagnosticQuestion"),
    help: document.getElementById("diagnosticHelp"),
    choices: document.getElementById("diagnosticChoices"),
    back: document.getElementById("diagnosticBack"),
    reset: document.getElementById("diagnosticReset"),
    result: document.getElementById("diagnosticResult"),
    sourceSearch: document.getElementById("sourceSearch"),
    sourceKind: document.getElementById("sourceKindFilter"),
    sourceList: document.getElementById("sourceList"),
    sourceCount: document.getElementById("sourceCount"),
    recent: document.getElementById("recentDiagnosis"),
    validation: document.getElementById("libraryValidationStatus")
  };

  function safeJson(raw, fallback = null) {
    try { return JSON.parse(raw); }
    catch { return fallback; }
  }

  function readServoForgeContext() {
    let saved = null;
    try { saved = safeJson(global.localStorage?.getItem(STORAGE_KEY), null); } catch { saved = null; }
    saved = saved && typeof saved === "object" ? saved : {};
    const mapLibrary = Array.isArray(saved.mapLibrary) ? saved.mapLibrary : [];
    const activeMap = mapLibrary.find((map) => map?.id === saved.activeMapId) || null;
    return {
      zone: saved.selectedZone || activeMap?.zone || "",
      site: saved.selectedSite || activeMap?.site || "",
      mapName: activeMap?.name || "",
      machineType: activeMap?.machineType || saved.machineType || "",
      applicationMode: activeMap?.applicationMode || saved.applicationMode || "",
      brand: saved.selectedBrand || "",
      bottle: saved.selectedBottle || ""
    };
  }

  function applyTheme() {
    let preset = "";
    try {
      preset = global.localStorage?.getItem("labelerThemePreset") || "";
      if (!preset) preset = safeJson(global.localStorage?.getItem(STORAGE_KEY), {})?.themePreset || "";
    } catch { }
    if (preset) document.body.dataset.theme = preset;
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function saveSession() {
    const snapshot = {
      flowId: state.flowId,
      nodeId: state.nodeId,
      history: state.history,
      resultId: state.resultId,
      query: state.query,
      savedAt: new Date().toISOString()
    };
    try { global.localStorage?.setItem(SESSION_KEY, JSON.stringify(snapshot)); } catch { }
  }

  function loadSession() {
    let saved = null;
    try { saved = safeJson(global.localStorage?.getItem(SESSION_KEY), null); } catch { }
    if (!saved || typeof saved !== "object") return;
    const flow = saved.flowId ? library.getFlow(saved.flowId) : null;
    if (flow && saved.nodeId && flow.nodes[saved.nodeId]) {
      state.flowId = flow.id;
      state.nodeId = saved.nodeId;
      state.history = Array.isArray(saved.history) ? saved.history.filter((id) => flow.nodes[id]) : [];
    }
    if (saved.resultId && library.getEntry(saved.resultId)) state.resultId = saved.resultId;
    state.query = typeof saved.query === "string" ? saved.query : "";
    if (els.recent && saved.savedAt) {
      const when = new Date(saved.savedAt);
      els.recent.textContent = Number.isNaN(when.getTime()) ? "Previous diagnostic available" : `Previous diagnostic saved ${when.toLocaleString()}`;
    }
  }

  function renderContext() {
    if (!els.context) return;
    const rows = [
      ["Site", state.context.site],
      ["Zone", state.context.zone],
      ["Map", state.context.mapName],
      ["Machine", state.context.machineType],
      ["Application", state.context.applicationMode ? state.context.applicationMode.toUpperCase() : ""],
      ["Brand", state.context.brand],
      ["Bottle", state.context.bottle]
    ].filter(([, value]) => String(value || "").trim());
    els.context.innerHTML = rows.length
      ? rows.map(([label, value]) => `<span class="sf-context-chip"><small>${esc(label)}</small><strong>${esc(value)}</strong></span>`).join("")
      : `<span class="sf-context-empty">No saved ServoForge machine context found. Troubleshooting will use the full library.</span>`;
  }

  function renderGuides() {
    els.guideCards.innerHTML = library.flows.map((flow) => `
      <button class="sf-guide-card" type="button" data-flow-id="${esc(flow.id)}">
        <span class="sf-guide-kicker">${esc(flow.category)}</span>
        <strong>${esc(flow.title)}</strong>
        <span>${esc(flow.description)}</span>
      </button>
    `).join("");
  }

  function sourceMarkup(ref) {
    const source = library.getSource(ref.sourceId);
    if (!source) return "";
    return `<li><strong>${esc(source.title)}</strong><span>${esc(ref.locator || source.file)}</span></li>`;
  }

  function entryCard(entry, compact = false) {
    const sourceCount = entry.sourceRefs?.length || 0;
    return `
      <article class="sf-entry-card ${compact ? "compact" : ""}" data-entry-id="${esc(entry.id)}">
        <header>
          <div><span class="sf-entry-category">${esc(entry.category)}</span><h3>${esc(entry.code || entry.title)}</h3></div>
          <span class="sf-source-count">${sourceCount} source${sourceCount === 1 ? "" : "s"}</span>
        </header>
        <strong class="sf-entry-title">${esc(entry.title)}</strong>
        <p>${esc(entry.summary)}</p>
        ${compact ? `<button type="button" data-open-entry="${esc(entry.id)}">Open diagnostic</button>` : ""}
      </article>`;
  }

  function performSearch() {
    const query = String(els.search?.value || "").trim();
    state.query = query;
    if (!query) {
      els.results.innerHTML = `<div class="sf-empty-state">Enter a fault code, alarm text, or symptom. Exact RPC messages such as <strong>SERVOCOUNT</strong> jump directly to the fault.</div>`;
      saveSession();
      return;
    }
    const matches = library.searchEntries(query, state.context, 8);
    if (!matches.length) {
      els.results.innerHTML = `<div class="sf-empty-state">No direct match for <strong>${esc(query)}</strong>. Use a guided path below, or search the reference library.</div>`;
      saveSession();
      return;
    }
    const exact = matches[0];
    const normalizedQuery = library.normalize(query).replaceAll(" ", "");
    const normalizedCode = library.normalize(exact.code).replaceAll(" ", "");
    if (normalizedQuery && normalizedQuery === normalizedCode) {
      showEntry(exact.id, { source: "search" });
      els.results.innerHTML = `<div class="sf-search-hit">Exact match opened: <strong>${esc(exact.code)}</strong></div>`;
    } else {
      els.results.innerHTML = matches.map((entry) => entryCard(entry, true)).join("");
    }
    saveSession();
  }

  function renderFlow() {
    const flow = library.getFlow(state.flowId);
    const node = flow?.nodes?.[state.nodeId];
    if (!flow || !node) {
      els.workspace.hidden = true;
      return;
    }
    els.workspace.hidden = false;
    els.breadcrumb.textContent = `${flow.title}${state.history.length ? ` • Step ${state.history.length + 1}` : " • Start"}`;
    els.question.textContent = node.question;
    els.help.textContent = node.help || flow.description;
    els.choices.innerHTML = node.choices.map((choice, index) => `
      <button type="button" class="sf-choice" data-choice-index="${index}">
        <strong>${esc(choice.label)}</strong>${choice.hint ? `<span>${esc(choice.hint)}</span>` : ""}
      </button>
    `).join("");
    els.back.disabled = state.history.length === 0;
  }

  function startFlow(flowId) {
    const flow = library.getFlow(flowId);
    if (!flow) return;
    state.flowId = flow.id;
    state.nodeId = flow.start;
    state.history = [];
    state.resultId = "";
    renderFlow();
    clearResult();
    saveSession();
    els.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function choose(index) {
    const flow = library.getFlow(state.flowId);
    const node = flow?.nodes?.[state.nodeId];
    const choice = node?.choices?.[index];
    if (!choice) return;
    if (choice.action === "search") {
      els.search.focus();
      els.search.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (choice.result) {
      state.history.push(state.nodeId);
      showEntry(choice.result, { source: "guide" });
      renderFlow();
      saveSession();
      return;
    }
    if (choice.next && flow.nodes[choice.next]) {
      state.history.push(state.nodeId);
      state.nodeId = choice.next;
      state.resultId = "";
      clearResult();
      renderFlow();
      saveSession();
    }
  }

  function goBack() {
    const previous = state.history.pop();
    if (!previous) return;
    state.nodeId = previous;
    state.resultId = "";
    clearResult();
    renderFlow();
    saveSession();
  }

  function resetFlow() {
    const flow = library.getFlow(state.flowId);
    if (!flow) return;
    state.nodeId = flow.start;
    state.history = [];
    state.resultId = "";
    clearResult();
    renderFlow();
    saveSession();
  }

  function clearResult() {
    els.result.hidden = true;
    els.result.innerHTML = "";
  }

  function resultList(title, rows, className = "") {
    if (!rows?.length) return "";
    return `<section class="sf-result-section ${className}"><h4>${esc(title)}</h4><ol>${rows.map((row) => `<li>${esc(row)}</li>`).join("")}</ol></section>`;
  }

  function showEntry(entryId, options = {}) {
    const entry = library.getEntry(entryId);
    if (!entry) return;
    state.resultId = entry.id;
    const contextSummary = [state.context.site, state.context.mapName, state.context.machineType, state.context.applicationMode].filter(Boolean).join(" • ");
    els.result.hidden = false;
    els.result.innerHTML = `
      <div class="sf-result-head">
        <div><span class="sf-entry-category">${esc(entry.category)}</span><h2>${esc(entry.code || entry.title)}</h2><p>${esc(entry.title)}</p></div>
        <button type="button" class="secondary-button" data-copy-diagnosis>Copy summary</button>
      </div>
      ${contextSummary ? `<div class="sf-result-context"><strong>Current ServoForge context:</strong> ${esc(contextSummary)}</div>` : ""}
      <p class="sf-result-summary">${esc(entry.summary)}</p>
      ${resultList("Most likely causes", entry.probableCauses)}
      ${resultList("Check in this order", entry.checks, "checks")}
      ${resultList("Corrective direction", entry.actions, "actions")}
      ${resultList("Safety boundary", entry.safety, "safety")}
      <section class="sf-result-section sources"><h4>Source references</h4><ul>${entry.sourceRefs.map(sourceMarkup).join("")}</ul></section>
      <div class="sf-result-foot"><span>${options.source === "search" ? "Opened from fault search" : "Reached through guided diagnosis"}</span><button type="button" data-search-related="${esc(entry.category)}">Show related faults</button></div>
    `;
    els.result.scrollIntoView({ behavior: "smooth", block: "start" });
    saveSession();
  }

  function copyDiagnosis() {
    const entry = library.getEntry(state.resultId);
    if (!entry) return;
    const sourceLines = entry.sourceRefs.map((ref) => {
      const source = library.getSource(ref.sourceId);
      return source ? `- ${source.title}${ref.locator ? ` — ${ref.locator}` : ""}` : "";
    }).filter(Boolean);
    const contextLines = Object.entries(state.context).filter(([, value]) => value).map(([key, value]) => `- ${key}: ${value}`);
    const text = [
      `ServoForge Troubleshooting — ${entry.code || entry.title}`,
      entry.title,
      "",
      entry.summary,
      "",
      contextLines.length ? `Machine context:\n${contextLines.join("\n")}` : "",
      `Checks:\n${entry.checks.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `Corrective direction:\n${entry.actions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `Sources:\n${sourceLines.join("\n")}`
    ].filter(Boolean).join("\n\n");
    global.navigator?.clipboard?.writeText(text).then(() => {
      const button = els.result.querySelector("[data-copy-diagnosis]");
      if (button) {
        const original = button.textContent;
        button.textContent = "Copied";
        global.setTimeout(() => { button.textContent = original; }, 1200);
      }
    }).catch(() => {});
  }

  function sourceStatusLabel(source) {
    return ({
      indexed: "Indexed",
      "visual-reference": "Visual reference",
      "binary-reference": "Binary control project",
      "metadata-only": "Metadata only",
      "link-only": "Shortcut only"
    })[source.status] || source.status;
  }

  function renderSourceKinds() {
    const kinds = [...new Set(library.sources.map((source) => source.kind))].sort();
    els.sourceKind.innerHTML = `<option value="">All reference types</option>${kinds.map((kind) => `<option value="${esc(kind)}">${esc(kind)}</option>`).join("")}`;
  }

  function renderSources() {
    const query = String(els.sourceSearch?.value || "").trim();
    const kind = String(els.sourceKind?.value || "");
    let rows = library.searchSources(query, library.sources.length);
    if (kind) rows = rows.filter((source) => source.kind === kind);
    els.sourceCount.textContent = `${rows.length} of ${library.sources.length} references`;
    els.sourceList.innerHTML = rows.map((source) => `
      <article class="sf-source-card">
        <header><span>${esc(source.kind)}</span><span class="sf-source-status ${esc(source.status)}">${esc(sourceStatusLabel(source))}</span></header>
        <strong>${esc(source.title)}</strong>
        <code>${esc(source.file)}</code>
        <p>${esc(source.notes || (source.topics || []).join(" • "))}</p>
      </article>
    `).join("") || `<div class="sf-empty-state">No references match this filter.</div>`;
  }

  function bind() {
    els.searchButton?.addEventListener("click", performSearch);
    els.search?.addEventListener("keydown", (event) => { if (event.key === "Enter") performSearch(); });
    els.guideCards?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-flow-id]");
      if (button) startFlow(button.dataset.flowId);
    });
    els.results?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-open-entry]");
      if (button) showEntry(button.dataset.openEntry, { source: "search" });
    });
    els.choices?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-choice-index]");
      if (button) choose(Number(button.dataset.choiceIndex));
    });
    els.back?.addEventListener("click", goBack);
    els.reset?.addEventListener("click", resetFlow);
    els.result?.addEventListener("click", (event) => {
      if (event.target.closest("[data-copy-diagnosis]")) copyDiagnosis();
      const related = event.target.closest("[data-search-related]");
      if (related) {
        els.search.value = related.dataset.searchRelated;
        performSearch();
        els.search.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    els.sourceSearch?.addEventListener("input", renderSources);
    els.sourceKind?.addEventListener("change", renderSources);
  }

  function initialize() {
    applyTheme();
    const validation = library.validate();
    if (els.validation) {
      els.validation.textContent = validation.ok
        ? `${library.entries.length} diagnostic entries • ${library.flows.length} guided paths • ${library.sources.length} archived references`
        : `Library validation failed: ${validation.errors.join(" | ")}`;
      els.validation.dataset.status = validation.ok ? "pass" : "fail";
    }
    renderContext();
    renderGuides();
    renderSourceKinds();
    renderSources();
    loadSession();
    if (state.query && els.search) els.search.value = state.query;
    if (state.flowId) renderFlow();
    if (state.resultId) showEntry(state.resultId, { source: "guide" });
    else clearResult();
    if (!state.query && els.results) {
      els.results.innerHTML = `<div class="sf-empty-state">Enter a fault code, alarm text, or symptom. Exact RPC messages such as <strong>SERVOCOUNT</strong> jump directly to the fault.</div>`;
    } else if (state.query) performSearch();
    bind();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})(window);
