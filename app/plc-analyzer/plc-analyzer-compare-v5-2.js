"use strict";

(function installPlcAnalyzerCompare(global) {
  const core = global.ServoForgeL5KAnalyzer;
  const compareCore = global.ServoForgeL5KCompare;
  if (!core || !compareCore) throw new Error("ServoForge PLC comparison dependencies did not load.");

  const state = {
    baselineFile: null,
    currentFile: null,
    baselineProject: null,
    currentProject: null,
    comparison: null,
    worker: null,
    comparing: false,
    page: 0,
    pageSize: 75
  };

  const id = (name) => document.getElementById(name);
  const els = {};
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function bytes(value) {
    const size = Number(value || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setStatus(message, kind = "") {
    els.status.textContent = message;
    els.status.dataset.status = kind;
  }

  function fileLabel(file) {
    return file ? `${file.name} • ${bytes(file.size)}` : "No file selected";
  }

  function refreshFileState() {
    els.baselineFile.textContent = fileLabel(state.baselineFile);
    els.currentFile.textContent = fileLabel(state.currentFile);
    els.compareButton.disabled = !(state.baselineFile && state.currentFile && !state.comparing);
    els.clearButton.disabled = !(state.baselineFile || state.currentFile || state.comparison || state.comparing);
    if (!state.baselineFile && !state.currentFile) setStatus("Choose two L5K files.");
    else if (!state.baselineFile) setStatus("Choose the known-good / baseline L5K.", "caution");
    else if (!state.currentFile) setStatus("Choose the current / problem L5K.", "caution");
    else if (!state.comparing) setStatus("Ready to compare locally.", "ready");
  }

  function setFile(role, file) {
    if (role === "baseline") state.baselineFile = file || null;
    else state.currentFile = file || null;
    state.baselineProject = null;
    state.currentProject = null;
    state.comparison = null;
    state.page = 0;
    els.results.hidden = true;
    refreshFileState();
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error(`Unable to read ${file?.name || "selected file"}.`));
      reader.readAsText(file);
    });
  }

  function createWorker() {
    try { return new Worker("./l5k-analyzer-compare-worker.js?v=5.2"); }
    catch { return null; }
  }

  async function compareProjects() {
    if (!state.baselineFile || !state.currentFile || state.comparing) return;
    state.comparing = true;
    els.compareButton.disabled = true;
    setStatus("Reading both L5K files locally…", "loading");
    try {
      const [baselineText, currentText] = await Promise.all([readFile(state.baselineFile), readFile(state.currentFile)]);
      setStatus("Parsing source, dependency graphs, and comparison…", "loading");
      const result = await new Promise((resolve, reject) => {
        const worker = createWorker();
        if (!worker) {
          try {
            const baseline = core.parseL5K(baselineText, { fileName: state.baselineFile.name, byteLength: state.baselineFile.size });
            const current = core.parseL5K(currentText, { fileName: state.currentFile.name, byteLength: state.currentFile.size });
            resolve({ baseline, current, comparison: compareCore.compareProjects(baseline, current, { baselineLabel: state.baselineFile.name, currentLabel: state.currentFile.name }) });
          } catch (error) { reject(error); }
          return;
        }
        state.worker = worker;
        worker.onmessage = (event) => {
          const payload = event.data || {};
          worker.terminate();
          state.worker = null;
          if (payload.type === "result") resolve(payload);
          else reject(new Error(payload.message || "PLC comparison worker failed."));
        };
        worker.onerror = (event) => {
          worker.terminate();
          state.worker = null;
          reject(new Error(event.message || "PLC comparison worker failed."));
        };
        worker.postMessage({
          type: "compare",
          baselineText,
          currentText,
          baselineFileName: state.baselineFile.name,
          currentFileName: state.currentFile.name,
          baselineByteLength: state.baselineFile.size,
          currentByteLength: state.currentFile.size
        });
      });
      state.baselineProject = result.baseline;
      state.currentProject = result.current;
      state.comparison = result.comparison;
      state.page = 0;
      renderComparison();
      const total = state.comparison.statistics?.totalDifferences || 0;
      const dependencies = state.comparison.statistics?.dependencyDifferences || 0;
      setStatus(`Comparison complete • ${total} source differences • ${dependencies} dependency-level differences.`, "pass");
    } catch (error) {
      console.error(error);
      state.baselineProject = null;
      state.currentProject = null;
      state.comparison = null;
      els.results.hidden = true;
      setStatus(`Comparison failed: ${error?.message || error}`, "error");
    } finally {
      state.comparing = false;
      refreshFileState();
    }
  }

  function summaryCard(label, value) {
    return `<div class="plc-summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function projectCard(label, project) {
    const stats = project?.statistics || {};
    const dependencyStats = project?.dependencies?.statistics || {};
    return `<div class="plc-compare-project-card">
      <span class="sf-eyebrow">${esc(label)}</span>
      <h3>${esc(project?.controller || project?.source?.fileName || "PLC project")}</h3>
      <dl>
        <dt>File</dt><dd>${esc(project?.source?.fileName || "?")}</dd>
        <dt>Export</dt><dd>${esc(project?.exportVersion || "not identified")}</dd>
        <dt>Rungs</dt><dd>${esc(stats.rungs || 0)}</dd>
        <dt>Fault targets</dt><dd>${esc(stats.faultTargets || 0)}</dd>
        <dt>UDTs</dt><dd>${esc(dependencyStats.dataTypes || 0)}</dd>
        <dt>JSR calls</dt><dd>${esc(dependencyStats.routineCalls || 0)}</dd>
        <dt>AOI definitions</dt><dd>${esc(dependencyStats.aoiDefinitions || 0)}</dd>
      </dl>
    </div>`;
  }

  function renderComparison() {
    const comparison = state.comparison;
    if (!comparison) return;
    els.results.hidden = false;
    els.title.textContent = `${comparison.options?.baselineLabel || "Baseline"} vs ${comparison.options?.currentLabel || "Current"}`;
    const stats = comparison.statistics || {};
    els.summaryStatus.textContent = `${comparison.baseline?.source?.lineCount || 0} baseline lines • ${comparison.current?.source?.lineCount || 0} current lines`;
    els.summaryCards.innerHTML = [
      summaryCard("Total differences", stats.totalDifferences || 0),
      summaryCard("Review items", stats.reviewCounts?.review || 0),
      summaryCard("Added", stats.changeCounts?.added || 0),
      summaryCard("Removed", stats.changeCounts?.removed || 0),
      summaryCard("Changed", stats.changeCounts?.changed || 0),
      summaryCard("Rung differences", stats.categoryCounts?.rungs || 0),
      summaryCard("Fault differences", stats.categoryCounts?.faults || 0),
      summaryCard("Dependency differences", stats.dependencyDifferences || 0)
    ].join("");
    els.projectCards.innerHTML = projectCard("BASELINE", state.baselineProject) + projectCard("CURRENT / PROBLEM", state.currentProject);
    resetFilters(false);
    els.detail.hidden = true;
  }

  function activeFilters() {
    return { query: els.search.value, category: els.category.value, changeType: els.changeType.value, reviewLevel: els.reviewLevel.value };
  }

  function differenceRow(item) {
    const dependencyBadge = item.category === "dependencies" && item.dependencyKind ? `<span class="plc-compare-badge">${esc(item.dependencyKind)}</span>` : "";
    return `<div class="plc-row plc-compare-diff" data-difference-id="${esc(item.id)}">
      <div class="plc-compare-diff-head"><div><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small></div>
      <div class="plc-compare-badges"><span class="plc-compare-badge" data-kind="${esc(item.changeType)}">${esc(item.changeType)}</span><span class="plc-compare-badge">${esc(item.category)}</span>${dependencyBadge}<span class="plc-compare-badge" data-kind="${esc(item.reviewLevel)}">${esc(item.reviewLevel)}</span><span class="plc-compare-badge">${esc(item.classification)}</span></div></div>
      <button type="button" class="secondary-button" data-open-difference="${esc(item.id)}">Review source difference</button>
    </div>`;
  }

  function renderDifferences() {
    if (!state.comparison) return;
    const matches = compareCore.filterDifferences(state.comparison, activeFilters());
    const totalPages = Math.max(1, Math.ceil(matches.length / state.pageSize));
    state.page = Math.min(Math.max(state.page, 0), totalPages - 1);
    const start = state.page * state.pageSize;
    const visible = matches.slice(start, start + state.pageSize);
    els.count.textContent = `${matches.length} matching difference${matches.length === 1 ? "" : "s"}`;
    if (!matches.length) {
      els.list.innerHTML = `<div class="plc-compare-no-differences"><strong>No matching source differences.</strong><p>Reset the filters or choose a different category/search term.</p></div>`;
      return;
    }
    const pager = totalPages > 1
      ? `<div class="plc-compare-pagination"><button type="button" class="secondary-button" data-compare-page="prev" ${state.page === 0 ? "disabled" : ""}>Previous</button><span>Showing ${start + 1}–${Math.min(start + state.pageSize, matches.length)} of ${matches.length}</span><button type="button" class="secondary-button" data-compare-page="next" ${state.page >= totalPages - 1 ? "disabled" : ""}>Next</button></div>`
      : "";
    els.list.innerHTML = visible.map(differenceRow).join("") + pager;
  }

  function formatValue(value) {
    if (value === null || value === undefined) return "Not present in this export";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  }

  function openDifference(value) {
    const item = (state.comparison?.differences || []).find((entry) => entry.id === value);
    if (!item) return;
    els.detailTitle.textContent = item.title;
    const dependencyBoundary = item.category === "dependencies"
      ? `<div class="plc-warning"><strong>Dependency comparison boundary:</strong> Source-visible call/type differences do not prove runtime execution, live state, physical device condition, or that a change is defective.</div>`
      : "";
    els.detailBody.innerHTML = `${dependencyBoundary}<div class="plc-section-box"><div class="plc-compare-badges"><span class="plc-compare-badge" data-kind="${esc(item.changeType)}">${esc(item.changeType)}</span><span class="plc-compare-badge">${esc(item.category)}</span>${item.dependencyKind ? `<span class="plc-compare-badge">${esc(item.dependencyKind)}</span>` : ""}<span class="plc-compare-badge" data-kind="${esc(item.reviewLevel)}">${esc(item.reviewLevel)}</span></div><p>${esc(item.summary)}</p></div>
      <div class="plc-compare-detail-grid"><div class="plc-compare-side"><h4>Baseline</h4><pre>${esc(formatValue(item.baseline))}</pre></div><div class="plc-compare-side"><h4>Current / problem</h4><pre>${esc(formatValue(item.current))}</pre></div></div>
      ${item.evidence ? `<div class="plc-section-box plc-compare-evidence"><h3>Source evidence</h3><pre>${esc(formatValue(item.evidence))}</pre></div>` : ""}`;
    els.detail.hidden = false;
    els.detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetFilters(render = true) {
    els.search.value = "";
    els.category.value = "all";
    els.changeType.value = "all";
    els.reviewLevel.value = "all";
    state.page = 0;
    if (render) renderDifferences();
    else renderDifferences();
  }

  function clearAll() {
    state.worker?.terminate();
    state.worker = null;
    state.baselineFile = null;
    state.currentFile = null;
    state.baselineProject = null;
    state.currentProject = null;
    state.comparison = null;
    state.comparing = false;
    state.page = 0;
    els.baselineInput.value = "";
    els.currentInput.value = "";
    els.results.hidden = true;
    refreshFileState();
  }

  function wireDropZone(role, zone, input) {
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); } });
    input.addEventListener("change", () => setFile(role, input.files?.[0] || null));
    ["dragenter", "dragover"].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.add("drag-over"); }));
    ["dragleave", "drop"].forEach((name) => zone.addEventListener(name, (event) => { event.preventDefault(); zone.classList.remove("drag-over"); }));
    zone.addEventListener("drop", (event) => setFile(role, event.dataTransfer?.files?.[0] || null));
  }

  function initialize() {
    Object.assign(els, {
      status: id("plcCompareStatus"), baselineDropZone: id("plcBaselineDropZone"), currentDropZone: id("plcCurrentDropZone"),
      baselineInput: id("plcBaselineInput"), currentInput: id("plcCurrentInput"), baselineFile: id("plcBaselineFile"), currentFile: id("plcCurrentFile"),
      compareButton: id("plcCompareButton"), clearButton: id("plcCompareClear"), results: id("plcCompareResults"), title: id("plcCompareTitle"),
      summaryStatus: id("plcCompareSummaryStatus"), summaryCards: id("plcCompareSummaryCards"), projectCards: id("plcCompareProjectCards"), search: id("plcCompareSearch"),
      category: id("plcCompareCategory"), changeType: id("plcCompareChangeType"), reviewLevel: id("plcCompareReviewLevel"), count: id("plcCompareCount"),
      list: id("plcCompareList"), resetFilters: id("plcCompareResetFilters"), detail: id("plcCompareDetail"), detailTitle: id("plcCompareDetailTitle"), detailBody: id("plcCompareDetailBody"), detailClose: id("plcCompareDetailClose")
    });
    wireDropZone("baseline", els.baselineDropZone, els.baselineInput);
    wireDropZone("current", els.currentDropZone, els.currentInput);
    els.compareButton.addEventListener("click", compareProjects);
    els.clearButton.addEventListener("click", clearAll);
    [els.search, els.category, els.changeType, els.reviewLevel].forEach((control) => control.addEventListener(control === els.search ? "input" : "change", () => { state.page = 0; renderDifferences(); }));
    els.resetFilters.addEventListener("click", () => resetFilters(true));
    els.detailClose.addEventListener("click", () => { els.detail.hidden = true; });
    els.list.addEventListener("click", (event) => {
      const open = event.target.closest?.("[data-open-difference]");
      if (open) { openDifference(open.dataset.openDifference); return; }
      const pager = event.target.closest?.("[data-compare-page]");
      if (!pager) return;
      state.page += pager.dataset.comparePage === "next" ? 1 : -1;
      renderDifferences();
    });
    refreshFileState();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})(window);
