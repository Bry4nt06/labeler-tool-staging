"use strict";

(function installPlcImportAssistant(global) {
  const core = global.ServoForgeL5KAnalyzer;
  const importer = global.ServoForgeL5KImport;
  if (!core || !importer) throw new Error("ServoForge PLC import assistant dependencies did not load.");

  const state = {
    file: null,
    project: null,
    queue: null,
    libraryEntries: [],
    libraryAvailable: false,
    analyzing: false
  };

  const id = (name) => document.getElementById(name);
  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const els = {};

  function bytes(value) {
    const size = Number(value || 0);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setFileStatus(message, kind = "") {
    els.fileStatus.textContent = message;
    els.fileStatus.dataset.status = kind;
  }

  function setLibraryStatus(message, kind = "") {
    els.libraryStatus.textContent = message;
    els.libraryStatus.dataset.status = kind;
  }

  function setFile(file) {
    state.file = file || null;
    state.project = null;
    state.queue = null;
    els.results.hidden = true;
    if (!file) {
      els.selectedFile.textContent = "No file selected";
      els.analyzeButton.disabled = true;
      els.clearButton.disabled = true;
      setFileStatus("No file selected.");
      return;
    }
    els.selectedFile.textContent = `${file.name} • ${bytes(file.size)}`;
    els.analyzeButton.disabled = false;
    els.clearButton.disabled = false;
    setFileStatus(/\.l5k$/i.test(file.name || "") ? "Ready to analyze locally." : "File selected; parser will attempt text analysis.", /\.l5k$/i.test(file.name || "") ? "ready" : "caution");
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read the selected file."));
      reader.readAsText(file);
    });
  }

  function parseInWorker(text) {
    return new Promise((resolve, reject) => {
      let worker;
      try { worker = new Worker("./l5k-analyzer-worker.js?v=5"); }
      catch { worker = null; }
      if (!worker) {
        try {
          resolve(core.parseL5K(text, { fileName: state.file?.name, byteLength: state.file?.size }));
        } catch (error) { reject(error); }
        return;
      }
      worker.onmessage = (event) => {
        const payload = event.data || {};
        worker.terminate();
        if (payload.type === "result") resolve(payload.project);
        else reject(new Error(payload.message || "L5K worker analysis failed."));
      };
      worker.onerror = (event) => {
        worker.terminate();
        reject(new Error(event.message || "L5K worker analysis failed."));
      };
      worker.postMessage({ type: "analyze", text, fileName: state.file?.name, byteLength: state.file?.size });
    });
  }

  function waitForTroubleshootingLibrary(timeoutMs = 20000) {
    const started = Date.now();
    return new Promise((resolve) => {
      const poll = () => {
        try {
          const frameWindow = els.libraryBridge.contentWindow;
          const library = frameWindow?.ServoForgeTroubleshootingLibrary;
          const bootstrap = frameWindow?.ServoForgeTroubleshootingBootstrap;
          const entries = Array.isArray(library?.entries) ? library.entries : null;
          const settled = bootstrap && bootstrap.currentSrc === "" && bootstrap.loaded?.length;
          if (entries && (settled || bootstrap?.interfaceReady)) {
            resolve({ available: true, entries });
            return;
          }
        } catch {
          // Same-origin bridge may still be navigating. Keep polling until timeout.
        }
        if (Date.now() - started >= timeoutMs) {
          resolve({ available: false, entries: [] });
          return;
        }
        global.setTimeout(poll, 250);
      };
      poll();
    });
  }

  function summaryCard(label, value) {
    return `<div class="plc-summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function coverageLabel(status) {
    if (status === "covered-exact-source-reference") return "Exact source reference already in library";
    if (status === "review-candidate") return "Review candidate";
    return "Coverage unverified";
  }

  function renderQueue() {
    const queue = state.queue;
    if (!queue) return;
    const stats = queue.statistics || {};
    els.results.hidden = false;
    els.controllerName.textContent = queue.project?.controller || queue.project?.sourceFile || "PLC project";
    els.analysisStatus.textContent = `${queue.project?.sourceFile || "L5K"} • ${queue.project?.exportVersion ? `Export ${queue.project.exportVersion}` : "version not identified"}`;
    els.summaryCards.innerHTML = [
      summaryCard("Fault targets", stats.totalFaultTargets || 0),
      summaryCard("Exact source covered", stats.coveredExactSource || 0),
      summaryCard("Review candidates", stats.reviewCandidates || 0),
      summaryCard("Coverage unverified", stats.coverageUnverified || 0),
      summaryCard("Dependency traced", stats.dependencyTraced || 0)
    ].join("");
    renderCandidates();
  }

  function renderCandidates() {
    if (!state.queue) return;
    const candidates = importer.filterImportQueue(state.queue, {
      search: els.search.value,
      coverageStatus: els.coverageFilter.value
    });
    els.resultCount.textContent = `${candidates.length} candidate${candidates.length === 1 ? "" : "s"}`;
    els.candidateList.innerHTML = candidates.length ? candidates.map((candidate) => {
      const matchText = candidate.coverageMatches?.length
        ? `${candidate.coverageMatches.length} matching library record${candidate.coverageMatches.length === 1 ? "" : "s"}`
        : "No exact PLC-target reference located in the loaded library snapshot";
      const dependencyCount = candidate.dependencyEvidence?.upstreamSymbols?.length || 0;
      return `<div class="plc-row plc-import-candidate" data-coverage="${esc(candidate.coverageStatus)}">
        <div class="plc-row-head"><strong><code>${esc(candidate.target)}</code></strong><span class="plc-evidence-label">${esc(coverageLabel(candidate.coverageStatus))}</span></div>
        <small>${esc(matchText)} • ${candidate.writers.length} writer(s) • ${candidate.resets.length} reset/unlatch path(s)</small>
        <div class="plc-import-status-row"><span class="plc-chip">${esc(candidate.relatedTimers.length)} timers</span><span class="plc-chip">${esc(candidate.relatedCounters.length)} counters</span><span class="plc-chip">${esc(candidate.ioReferences.length)} I/O refs</span><span class="plc-chip">${esc(candidate.motionReferences.length)} motion refs</span><span class="plc-chip">${esc(dependencyCount)} dependency nodes</span></div>
        <button type="button" class="secondary-button" data-plc-import-open="${esc(candidate.target)}">Open draft evidence</button>
      </div>`;
    }).join("") : `<div class="plc-empty">No candidates match the current filter.</div>`;
  }

  function renderJson(value) {
    return `<pre><code>${esc(JSON.stringify(value, null, 2))}</code></pre>`;
  }

  function openCandidate(target) {
    const candidate = state.queue?.candidates?.find((item) => item.target === target);
    if (!candidate) return;
    els.detailTitle.textContent = candidate.target;
    const coverage = candidate.coverageMatches?.length
      ? candidate.coverageMatches.map((match) => `<div class="plc-row"><strong>${esc(match.title)}</strong><small>ID ${esc(match.id ?? "—")} • Code ${esc(match.code ?? "—")}</small></div>`).join("")
      : `<div class="plc-empty">No exact target-string match was found. SME review is required before calling this a library gap.</div>`;
    const dependency = candidate.dependencyEvidence
      ? `<div class="plc-import-evidence-box"><h3>Dependency trace evidence</h3><p>${esc(candidate.dependencyEvidence.sourceBoundary)}</p>${renderJson(candidate.dependencyEvidence)}</div>`
      : `<div class="plc-import-evidence-box"><h3>Dependency trace evidence</h3><div class="plc-empty">No v5 dependency graph was available for this candidate. Producer evidence remains valid; upstream source tracing requires a dependency-enabled parse.</div></div>`;
    els.detailBody.innerHTML = `<div class="plc-import-evidence-grid">
      <div class="plc-import-evidence-box"><h3>Coverage</h3><p><strong>${esc(coverageLabel(candidate.coverageStatus))}</strong></p>${coverage}</div>
      <div class="plc-import-evidence-box"><h3>Draft publication boundary</h3><p>${esc(candidate.draft.sourceBoundary)}</p><ul class="plc-import-unresolved-list">${candidate.draft.unresolvedFields.map((field) => `<li>${esc(field)}</li>`).join("")}</ul></div>
      <div class="plc-import-evidence-box"><h3>Producer evidence</h3>${renderJson(candidate.writers)}</div>
      <div class="plc-import-evidence-box"><h3>Reset evidence</h3>${renderJson(candidate.resets)}</div>
      <div class="plc-import-evidence-box"><h3>Related timing / I/O / motion</h3>${renderJson({ timers: candidate.relatedTimers, counters: candidate.relatedCounters, ioReferences: candidate.ioReferences, motionReferences: candidate.motionReferences })}</div>
      ${dependency}
      <div class="plc-import-evidence-box"><h3>Review JSON draft</h3>${renderJson(candidate.draft)}</div>
    </div>`;
    els.detailPanel.hidden = false;
    els.detailPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function analyze() {
    if (!state.file || state.analyzing) return;
    state.analyzing = true;
    els.analyzeButton.disabled = true;
    setFileStatus(`Reading ${state.file.name} locally…`, "loading");
    setLibraryStatus("Loading current Troubleshooting Library coverage…", "loading");
    try {
      const [text, coverage] = await Promise.all([readFile(state.file), waitForTroubleshootingLibrary()]);
      state.libraryEntries = coverage.entries;
      state.libraryAvailable = coverage.available;
      setLibraryStatus(coverage.available ? `${coverage.entries.length} current Troubleshooting Library entries loaded for exact-source comparison.` : "Coverage bridge did not finish. Candidates will be marked coverage unverified.", coverage.available ? "pass" : "caution");
      setFileStatus("Parsing PLC source and dependency graph…", "loading");
      state.project = await parseInWorker(text);
      state.queue = importer.buildImportQueue(state.project, state.libraryEntries, { libraryAvailable: state.libraryAvailable });
      renderQueue();
      setFileStatus(`Review queue built from ${state.project.statistics?.rungs || 0} indexed rungs • ${state.queue.statistics?.dependencyTraced || 0} dependency traces.`, "pass");
    } catch (error) {
      console.error(error);
      state.project = null;
      state.queue = null;
      els.results.hidden = true;
      setFileStatus(`Analysis failed: ${error?.message || error}`, "error");
    } finally {
      state.analyzing = false;
      els.analyzeButton.disabled = !state.file;
    }
  }

  function reviewPayload() {
    return importer.exportReviewQueue(state.queue, {
      generatedAt: new Date().toISOString(),
      includeCovered: false
    });
  }

  function downloadReview() {
    if (!state.queue) return;
    const blob = new Blob([JSON.stringify(reviewPayload(), null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const base = String(state.project?.source?.fileName || "plc").replace(/\.l5k$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-");
    link.href = href;
    link.download = `${base}-servoforge-import-review.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
  }

  async function copyReview() {
    if (!state.queue) return;
    const text = JSON.stringify(reviewPayload(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      els.copyButton.textContent = "Copied";
      global.setTimeout(() => { els.copyButton.textContent = "Copy Review JSON"; }, 1500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  }

  function bind() {
    Object.assign(els, {
      fileInput: id("plcImportFileInput"),
      dropZone: id("plcImportDropZone"),
      selectedFile: id("plcImportSelectedFile"),
      fileStatus: id("plcImportFileStatus"),
      analyzeButton: id("plcImportAnalyzeButton"),
      clearButton: id("plcImportClearButton"),
      libraryStatus: id("plcImportLibraryStatus"),
      libraryBridge: id("plcTroubleshootingLibraryBridge"),
      results: id("plcImportResults"),
      controllerName: id("plcImportControllerName"),
      analysisStatus: id("plcImportAnalysisStatus"),
      summaryCards: id("plcImportSummaryCards"),
      downloadButton: id("plcImportDownloadButton"),
      copyButton: id("plcImportCopyButton"),
      search: id("plcImportSearch"),
      coverageFilter: id("plcImportCoverageFilter"),
      resultCount: id("plcImportResultCount"),
      candidateList: id("plcImportCandidateList"),
      detailPanel: id("plcImportDetailPanel"),
      detailTitle: id("plcImportDetailTitle"),
      detailBody: id("plcImportDetailBody"),
      detailClose: id("plcImportDetailClose")
    });

    els.dropZone.addEventListener("click", () => els.fileInput.click());
    els.dropZone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.fileInput.click(); } });
    els.fileInput.addEventListener("change", () => setFile(els.fileInput.files?.[0] || null));
    ["dragenter", "dragover"].forEach((name) => els.dropZone.addEventListener(name, (event) => { event.preventDefault(); els.dropZone.dataset.dragging = "true"; }));
    ["dragleave", "drop"].forEach((name) => els.dropZone.addEventListener(name, (event) => { event.preventDefault(); delete els.dropZone.dataset.dragging; }));
    els.dropZone.addEventListener("drop", (event) => setFile(event.dataTransfer?.files?.[0] || null));
    els.analyzeButton.addEventListener("click", analyze);
    els.clearButton.addEventListener("click", () => { els.fileInput.value = ""; setFile(null); els.detailPanel.hidden = true; setLibraryStatus("Waiting for analysis."); });
    els.search.addEventListener("input", renderCandidates);
    els.coverageFilter.addEventListener("change", renderCandidates);
    els.candidateList.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-plc-import-open]");
      if (button) openCandidate(button.dataset.plcImportOpen);
    });
    els.detailClose.addEventListener("click", () => { els.detailPanel.hidden = true; });
    els.downloadButton.addEventListener("click", downloadReview);
    els.copyButton.addEventListener("click", copyReview);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();
})(window);
