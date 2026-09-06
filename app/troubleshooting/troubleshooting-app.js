"use strict";

(function startServoForgeTroubleshooting(global) {
  const library = global.ServoForgeTroubleshootingLibrary;
  if (!library) throw new Error("ServoForge troubleshooting library is unavailable.");

  const STORAGE_KEY = "labelerToolSettings";
  const SESSION_KEY = "servoforge-troubleshooting-session-v1";
  const RESOLUTION_KEY = "servoforge-troubleshooting-resolutions-v1";
  const RESOLUTION_LIMIT = 100;
  const state = {
    context: readServoForgeContext(),
    flowId: "",
    nodeId: "",
    history: [],
    trail: [],
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

  function installPhase2Styles() {
    if (document.getElementById("sfTroubleshootingPhase2Styles")) return;
    const style = document.createElement("style");
    style.id = "sfTroubleshootingPhase2Styles";
    style.textContent = `
      .sf-guide-card[data-context-recommended="true"] { border-color: var(--green); box-shadow: inset 0 0 0 1px rgba(65,200,137,.2); }
      .sf-guide-recommended { display: inline-flex; margin-left: 6px; padding: 2px 6px; border: 1px solid rgba(65,200,137,.42); border-radius: 999px; color: var(--green); font-size: 9px; letter-spacing: .06em; text-transform: uppercase; }
      .sf-result-tools { display: flex; flex-wrap: wrap; gap: 7px; justify-content: flex-end; }
      .sf-prior-fix-list { display: grid; gap: 8px; margin-top: 8px; }
      .sf-prior-fix { padding: 10px 11px; border: 1px solid var(--line); border-radius: 7px; background: var(--input); }
      .sf-prior-fix header { display: flex; gap: 8px; justify-content: space-between; color: var(--muted); font-size: 10px; }
      .sf-prior-fix p { margin: 6px 0 0; line-height: 1.45; font-size: 12px; }
      .sf-resolution-form { display: grid; gap: 8px; }
      .sf-resolution-form label { display: grid; gap: 5px; color: var(--muted); font-size: 11px; font-weight: 700; }
      .sf-resolution-form select, .sf-resolution-form textarea { width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--input); color: var(--ink); }
      .sf-resolution-form textarea { min-height: 86px; resize: vertical; }
      .sf-resolution-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .sf-resolution-status { color: var(--green); font-size: 11px; }
      .sf-print-only { display: none; }
      @media print {
        body.sf-print-diagnosis { background: #fff !important; color: #000 !important; }
        body.sf-print-diagnosis .staging-environment-banner,
        body.sf-print-diagnosis .troubleshooting-topbar,
        body.sf-print-diagnosis .sf-troubleshooting-hero,
        body.sf-print-diagnosis .sf-context-panel,
        body.sf-print-diagnosis .sf-search-panel,
        body.sf-print-diagnosis .sf-guide-panel,
        body.sf-print-diagnosis .sf-diagnostic-workspace,
        body.sf-print-diagnosis .sf-reference-panel,
        body.sf-print-diagnosis .sf-troubleshooting-footer,
        body.sf-print-diagnosis .sf-result-tools,
        body.sf-print-diagnosis .sf-result-foot,
        body.sf-print-diagnosis .sf-resolution-actions { display: none !important; }
        body.sf-print-diagnosis .troubleshooting-app { max-width: none; margin: 0; padding: 0; }
        body.sf-print-diagnosis .sf-diagnostic-result { display: block !important; margin: 0; padding: 0; border: 0; box-shadow: none; background: #fff !important; color: #000 !important; }
        body.sf-print-diagnosis .sf-result-section,
        body.sf-print-diagnosis .sf-result-context,
        body.sf-print-diagnosis .sf-prior-fix { break-inside: avoid; background: transparent !important; color: #000 !important; }
        body.sf-print-diagnosis .sf-print-only { display: block !important; margin-bottom: 16px; }
        body.sf-print-diagnosis .sf-print-only h1 { margin: 0 0 4px; font-size: 20pt; }
        body.sf-print-diagnosis .sf-print-only p { margin: 2px 0; font-size: 9pt; }
      }
    `;
    document.head.appendChild(style);
  }

  function readResolutionHistory() {
    let saved = null;
    try { saved = safeJson(global.localStorage?.getItem(RESOLUTION_KEY), []); } catch { saved = []; }
    return Array.isArray(saved) ? saved.filter((row) => row && typeof row === "object") : [];
  }

  function writeResolutionHistory(rows) {
    try { global.localStorage?.setItem(RESOLUTION_KEY, JSON.stringify(rows.slice(0, RESOLUTION_LIMIT))); } catch { }
  }

  function contextAffinity(savedContext = {}, currentContext = state.context) {
    const fields = ["site", "zone", "mapName", "machineType", "applicationMode", "brand", "bottle"];
    return fields.reduce((score, field) => {
      const left = library.normalize(savedContext?.[field]);
      const right = library.normalize(currentContext?.[field]);
      return left && right && left === right ? score + (field === "machineType" || field === "applicationMode" ? 3 : 1) : score;
    }, 0);
  }

  function relatedResolutions(entry, limit = 3) {
    if (!entry) return [];
    return readResolutionHistory()
      .map((row) => ({ row, score: (row.entryId === entry.id ? 20 : row.category === entry.category ? 5 : 0) + contextAffinity(row.context) }))
      .filter((item) => item.score > 0 && item.row.note)
      .sort((a, b) => b.score - a.score || String(b.row.createdAt || "").localeCompare(String(a.row.createdAt || "")))
      .slice(0, limit)
      .map((item) => item.row);
  }

  function guidedTrailText() {
    return state.trail.map((step, index) => `${index + 1}. ${step.question} → ${step.choice}`).join("\n");
  }

  function saveSession() {
    const snapshot = {
      flowId: state.flowId,
      nodeId: state.nodeId,
      history: state.history,
      trail: state.trail,
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
      state.trail = Array.isArray(saved.trail) ? saved.trail.filter((step) => step && typeof step === "object") : [];
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
    const ranked = typeof library.recommendFlows === "function" ? library.recommendFlows(state.context) : library.flows;
    els.guideCards.innerHTML = ranked.map((flow, index) => {
      const recommended = Number(flow.contextScore || 0) > 0 && index < 2;
      return `
        <button class="sf-guide-card" type="button" data-flow-id="${esc(flow.id)}" data-context-recommended="${recommended ? "true" : "false"}">
          <span class="sf-guide-kicker">${esc(flow.category)}${recommended ? `<span class="sf-guide-recommended">Recommended</span>` : ""}</span>
          <strong>${esc(flow.title)}</strong>
          <span>${esc(flow.description)}</span>
        </button>
      `;
    }).join("");
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

  function resetActiveGuidedSessionForSearch() {
    state.flowId = "";
    state.nodeId = "";
    state.history = [];
    state.trail = [];
    state.resultId = "";
    if (els.workspace) els.workspace.hidden = true;
    clearResult();
  }

  function performSearch() {
    const query = String(els.search?.value || "").trim();
    state.query = query;
    if (!query) {
      els.results.innerHTML = `<div class="sf-empty-state">Enter a fault code, alarm text, or symptom. Exact RPC messages such as <strong>SERVOCOUNT</strong> jump directly to the fault.</div>`;
      saveSession();
      return;
    }
    resetActiveGuidedSessionForSearch();
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
    state.trail = [];
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
      state.trail.push({ nodeId: state.nodeId, question: node.question, choice: choice.label });
      showEntry(choice.result, { source: "guide" });
      renderFlow();
      saveSession();
      return;
    }
    if (choice.next && flow.nodes[choice.next]) {
      state.history.push(state.nodeId);
      state.trail.push({ nodeId: state.nodeId, question: node.question, choice: choice.label });
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
    state.trail.pop();
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
    state.trail = [];
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

  function priorFixMarkup(entry) {
    const rows = relatedResolutions(entry, 3);
    if (!rows.length) return `<section class="sf-result-section"><h4>Previous technician resolutions</h4><p class="sf-context-empty">No matching saved fixes yet. A resolution saved below will become local evidence for the next similar fault.</p></section>`;
    return `<section class="sf-result-section"><h4>Previous technician resolutions</h4><div class="sf-prior-fix-list">${rows.map((row) => {
      const when = new Date(row.createdAt);
      const timestamp = Number.isNaN(when.getTime()) ? row.createdAt : when.toLocaleString();
      const context = [row.context?.machineType, row.context?.applicationMode, row.context?.mapName, row.context?.brand].filter(Boolean).join(" • ");
      return `<article class="sf-prior-fix"><header><strong>${esc((row.outcome || "saved").toUpperCase())}</strong><span>${esc(timestamp || "")}</span></header>${context ? `<span class="sf-entry-category">${esc(context)}</span>` : ""}<p>${esc(row.note)}</p></article>`;
    }).join("")}</div></section>`;
  }

  function resolutionMarkup() {
    return `<section class="sf-result-section sf-resolution-section"><h4>Record technician resolution</h4><div class="sf-resolution-form">
      <label>Outcome<select data-resolution-outcome><option value="fixed">Fixed</option><option value="monitoring">Monitoring</option><option value="not-fixed">Not fixed / escalated</option></select></label>
      <label>What actually fixed it / what was found<textarea data-resolution-note placeholder="Example: Agg 3 orientation shifted after encoder replacement; RPC sync was 0.4° off. Resynchronized table cam and verified motor assignment."></textarea></label>
      <div class="sf-resolution-actions"><button type="button" data-save-resolution>Save resolution locally</button><span class="sf-resolution-status" data-resolution-status></span></div>
    </div></section>`;
  }

  function currentContextLines() {
    return Object.entries(state.context).filter(([, value]) => value).map(([key, value]) => `- ${key}: ${value}`);
  }

  function buildDiagnosisText(entry) {
    const sourceLines = entry.sourceRefs.map((ref) => {
      const source = library.getSource(ref.sourceId);
      return source ? `- ${source.title}${ref.locator ? ` — ${ref.locator}` : ""}` : "";
    }).filter(Boolean);
    const trail = guidedTrailText();
    return [
      `ServoForge Troubleshooting — ${entry.code || entry.title}`,
      entry.title,
      "",
      entry.summary,
      "",
      currentContextLines().length ? `Machine context:\n${currentContextLines().join("\n")}` : "",
      trail ? `Guided path:\n${trail}` : "",
      `Most likely causes:\n${entry.probableCauses.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `Checks:\n${entry.checks.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `Corrective direction:\n${entry.actions.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `Safety boundary:\n${entry.safety.map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
      `Sources:\n${sourceLines.join("\n")}`
    ].filter(Boolean).join("\n\n");
  }

  function saveResolution() {
    const entry = library.getEntry(state.resultId);
    if (!entry || !els.result) return;
    const outcome = String(els.result.querySelector("[data-resolution-outcome]")?.value || "fixed");
    const note = String(els.result.querySelector("[data-resolution-note]")?.value || "").trim();
    const status = els.result.querySelector("[data-resolution-status]");
    if (!note) {
      if (status) status.textContent = "Add what was found or changed before saving.";
      return;
    }
    const rows = readResolutionHistory();
    rows.unshift({
      id: `resolution-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      entryId: entry.id,
      code: entry.code || "",
      title: entry.title,
      category: entry.category,
      outcome,
      note,
      context: { ...state.context },
      flowId: state.flowId,
      trail: state.trail.map((step) => ({ ...step }))
    });
    writeResolutionHistory(rows);
    if (status) status.textContent = "Resolution saved. It will be suggested on matching future faults.";
    const prior = els.result.querySelector("[data-prior-fixes]");
    if (prior) prior.innerHTML = priorFixMarkup(entry);
    saveSession();
  }

  function printDiagnosis() {
    const entry = library.getEntry(state.resultId);
    if (!entry) return;
    const generated = els.result.querySelector("[data-print-generated]");
    if (generated) generated.textContent = `Generated ${new Date().toLocaleString()} • ${library.version}`;
    document.body.classList.add("sf-print-diagnosis");
    const cleanup = () => document.body.classList.remove("sf-print-diagnosis");
    global.addEventListener?.("afterprint", cleanup, { once: true });
    global.print();
    global.setTimeout(cleanup, 1000);
  }

  function showEntry(entryId, options = {}) {
    const entry = library.getEntry(entryId);
    if (!entry) return;
    state.resultId = entry.id;
    const contextSummary = [state.context.site, state.context.mapName, state.context.machineType, state.context.applicationMode].filter(Boolean).join(" • ");
    els.result.hidden = false;
    els.result.innerHTML = `
      <div class="sf-print-only"><h1>ServoForge Troubleshooting Report</h1><p><strong>${esc(entry.code || entry.title)}</strong> — ${esc(entry.title)}</p><p data-print-generated></p></div>
      <div class="sf-result-head">
        <div><span class="sf-entry-category">${esc(entry.category)}</span><h2>${esc(entry.code || entry.title)}</h2><p>${esc(entry.title)}</p></div>
        <div class="sf-result-tools"><button type="button" class="secondary-button" data-copy-diagnosis>Copy summary</button><button type="button" class="secondary-button" data-print-diagnosis>Print report</button></div>
      </div>
      ${contextSummary ? `<div class="sf-result-context"><strong>Current ServoForge context:</strong> ${esc(contextSummary)}</div>` : ""}
      ${state.trail.length ? `<div class="sf-result-context"><strong>Guided path:</strong> ${state.trail.map((step) => esc(step.choice)).join(" → ")}</div>` : ""}
      <p class="sf-result-summary">${esc(entry.summary)}</p>
      ${resultList("Most likely causes", entry.probableCauses)}
      ${resultList("Check in this order", entry.checks, "checks")}
      ${resultList("Corrective direction", entry.actions, "actions")}
      ${resultList("Safety boundary", entry.safety, "safety")}
      <section class="sf-result-section sources"><h4>Source references</h4><ul>${entry.sourceRefs.map(sourceMarkup).join("")}</ul></section>
      <div data-prior-fixes>${priorFixMarkup(entry)}</div>
      ${resolutionMarkup()}
      <div class="sf-result-foot"><span>${options.source === "search" ? "Opened from fault search" : "Reached through guided diagnosis"}</span><button type="button" data-search-related="${esc(entry.category)}">Show related faults</button></div>
    `;
    els.result.scrollIntoView({ behavior: "smooth", block: "start" });
    saveSession();
  }

  function copyDiagnosis() {
    const entry = library.getEntry(state.resultId);
    if (!entry) return;
    const text = buildDiagnosisText(entry);
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
      if (event.target.closest("[data-print-diagnosis]")) printDiagnosis();
      if (event.target.closest("[data-save-resolution]")) saveResolution();
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
    installPhase2Styles();
    const validation = library.validate();
    if (els.validation) {
      els.validation.textContent = validation.ok
        ? `${library.entries.length} diagnostic entries • ${library.flows.length} guided paths • ${library.sources.length} archived references • machine-aware routing + local resolution history`
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