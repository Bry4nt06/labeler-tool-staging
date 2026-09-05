"use strict";

(function installPlcAnalyzer(global) {
  const core = global.ServoForgeL5KAnalyzer;
  if (!core) throw new Error("ServoForge L5K analyzer core did not load.");

  const state = {
    file: null,
    project: null,
    worker: null,
    analyzing: false
  };

  const els = {};
  const id = (name) => document.getElementById(name);
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
    els.fileStatus.textContent = message;
    els.fileStatus.dataset.status = kind;
  }

  function setFile(file) {
    state.file = file || null;
    state.project = null;
    if (!file) {
      els.selectedFile.textContent = "No file selected";
      els.analyzeButton.disabled = true;
      els.clearButton.disabled = true;
      els.results.hidden = true;
      setStatus("No file selected.");
      return;
    }
    const extensionOk = /\.l5k$/i.test(file.name || "");
    els.selectedFile.textContent = `${file.name} • ${bytes(file.size)}`;
    els.analyzeButton.disabled = false;
    els.clearButton.disabled = false;
    setStatus(extensionOk ? "Ready to analyze locally." : "File selected. L5K extension was not detected; parser will still attempt text analysis.", extensionOk ? "ready" : "caution");
  }

  function chooseDroppedFile(files) {
    const file = files?.[0] || null;
    if (file) setFile(file);
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read the selected file."));
      reader.readAsText(file);
    });
  }

  function createWorker() {
    try {
      return new Worker("./l5k-analyzer-worker.js?v=11");
    } catch (_error) {
      return null;
    }
  }

  async function analyze() {
    if (!state.file || state.analyzing) return;
    state.analyzing = true;
    els.analyzeButton.disabled = true;
    setStatus(`Reading ${state.file.name} locally…`, "loading");
    try {
      const text = await readFile(state.file);
      setStatus("Parsing controller project…", "loading");
      const project = await new Promise((resolve, reject) => {
        const worker = createWorker();
        if (!worker) {
          try {
            resolve(core.parseL5K(text, { fileName: state.file.name, byteLength: state.file.size }));
          } catch (error) {
            reject(error);
          }
          return;
        }
        state.worker = worker;
        worker.onmessage = (event) => {
          const payload = event.data || {};
          if (payload.type === "result") resolve(payload.project);
          else if (payload.type === "error") reject(new Error(payload.message || "L5K worker analysis failed."));
          worker.terminate();
          state.worker = null;
        };
        worker.onerror = (event) => {
          reject(new Error(event.message || "L5K worker analysis failed."));
          worker.terminate();
          state.worker = null;
        };
        worker.postMessage({ type: "analyze", text, fileName: state.file.name, byteLength: state.file.size });
      });
      state.project = project;
      renderProject();
      setStatus(`Analysis complete • ${project.statistics.rungs} rungs indexed.`, "pass");
    } catch (error) {
      console.error(error);
      state.project = null;
      els.results.hidden = true;
      setStatus(`Analysis failed: ${error?.message || error}`, "error");
    } finally {
      state.analyzing = false;
      els.analyzeButton.disabled = !state.file;
    }
  }

  function summaryCard(label, value) {
    return `<div class="plc-summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function rowButton(type, key, label = "Open evidence") {
    return `<button type="button" class="secondary-button" data-plc-open-type="${esc(type)}" data-plc-open-key="${esc(key)}">${esc(label)}</button>`;
  }

  function renderProject() {
    const project = state.project;
    if (!project) return;
    els.results.hidden = false;
    els.controllerName.textContent = project.controller || project.source?.fileName || "PLC project";
    els.analysisStatus.textContent = `${project.source?.lineCount || 0} source lines • ${project.exportVersion ? `Export ${project.exportVersion}` : "export version not identified"}`;
    const stats = project.statistics || {};
    els.summaryCards.innerHTML = [
      summaryCard("Programs", stats.programs || 0),
      summaryCard("Routines", stats.routines || 0),
      summaryCard("Rungs", stats.rungs || 0),
      summaryCard("Tags", stats.tags || 0),
      summaryCard("Modules", stats.modules || 0),
      summaryCard("Axes", stats.axes || 0),
      summaryCard("Timers", stats.timers || 0),
      summaryCard("Counters", stats.counters || 0),
      summaryCard("Fault targets", stats.faultTargets || 0),
      summaryCard("I/O references", stats.ioReferences || 0),
      summaryCard("Findings", stats.findings || 0)
    ].join("");
    renderOverview();
    renderFaults();
    renderTimers();
    renderIo();
    renderMotion();
    renderFindings();
    els.searchInput.value = "";
    els.searchResults.innerHTML = "";
    els.searchCount.textContent = "";
    els.rawSearchInput.value = "";
    els.rawSearchResults.innerHTML = "";
    els.detailPanel.hidden = true;
  }

  function renderOverview() {
    const project = state.project;
    const routineByProgram = new Map();
    for (const routine of project.routines || []) {
      const key = routine.program || "(unscoped)";
      if (!routineByProgram.has(key)) routineByProgram.set(key, []);
      routineByProgram.get(key).push(routine.name);
    }
    const rows = [...routineByProgram.entries()].map(([program, routines]) => `<tr><td>${esc(program)}</td><td>${esc(routines.length)}</td><td>${routines.slice(0, 12).map((name) => `<span class="plc-chip">${esc(name)}</span>`).join(" ")}${routines.length > 12 ? ` <span class="plc-chip">+${routines.length - 12} more</span>` : ""}</td></tr>`).join("");
    const aliases = (project.tags || []).filter((tag) => tag.aliasFor);
    els.projectStructure.innerHTML = `<div class="plc-two-column">
      <div class="plc-section-box"><h3>Controller</h3><div class="plc-chip-row"><span class="plc-chip">${esc(project.controller || "Not identified")}</span>${project.exportVersion ? `<span class="plc-chip">Export ${esc(project.exportVersion)}</span>` : ""}<span class="plc-chip">${esc(project.source?.fileName || "L5K")}</span></div><small>${esc(project.source?.lineCount || 0)} lines • ${esc(bytes(project.source?.byteLength || 0))}</small></div>
      <div class="plc-section-box"><h3>Source boundaries</h3><small>Static source evidence only. Runtime state, scan duration, physical wiring condition, input polarity and device health are not proven by this export.</small><small>${aliases.length} alias declaration(s) found.</small></div>
    </div>
    <div class="plc-section-box"><h3>Programs and routines</h3>${rows ? `<div style="overflow:auto"><table class="plc-structure-table"><thead><tr><th>Program</th><th>Routines</th><th>Examples</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="plc-empty">No PROGRAM/ROUTINE declarations were recognized in this export.</div>`}</div>`;
  }

  function renderFaults() {
    const faults = state.project.faultWriters || [];
    els.faultList.innerHTML = faults.length ? `<div class="plc-list">${faults.map((fault) => {
      const writerTypes = [...new Set(fault.writers.map((writer) => writer.instruction))].join(", ");
      return `<div class="plc-row"><div class="plc-row-head"><strong><code>${esc(fault.target)}</code></strong><span class="plc-chip">${esc(writerTypes)}</span></div><small>${fault.writerCount} writer(s) • ${fault.resets.length} direct reset/unlatch path(s) located</small>${rowButton("fault", fault.target)}</div>`;
    }).join("")}</div>` : `<div class="plc-empty">No fault-like OTE/OTL targets were recognized.</div>`;
  }

  function renderTimers() {
    const timers = state.project.timers || [];
    const counters = state.project.counters || [];
    const timerRows = timers.map((timer) => `<div class="plc-row"><div class="plc-row-head"><strong><code>${esc(timer.tag)}</code></strong><span class="plc-chip">${esc(timer.instructions.map((item) => item.type).join(", ") || "declared TIMER")}</span></div><small>${timer.presetValues?.length ? `Source-proven numeric PRE: ${esc(timer.presetValues.join(", "))}` : "No numeric PRE extracted"} • ${timer.references?.length || 0} reference rung(s)</small>${rowButton("timer", timer.tag)}</div>`).join("");
    const counterRows = counters.map((counter) => `<div class="plc-row"><div class="plc-row-head"><strong><code>${esc(counter.tag)}</code></strong><span class="plc-chip">${esc(counter.instructions.map((item) => item.type).join(", ") || "declared COUNTER")}</span></div><small>${counter.resets?.length || 0} RES path(s) located</small>${rowButton("counter", counter.tag)}</div>`).join("");
    els.timerList.innerHTML = `<div class="plc-two-column"><div class="plc-section-box"><h3>Native timers</h3>${timerRows || `<div class="plc-empty">No TON/TOF/RTO instances found.</div>`}</div><div class="plc-section-box"><h3>Native counters</h3>${counterRows || `<div class="plc-empty">No CTU/CTD instances found.</div>`}</div></div>`;
  }

  function renderIo() {
    const project = state.project;
    const aliases = (project.tags || []).filter((tag) => tag.aliasFor);
    const modules = project.modules || [];
    const gsv = project.moduleStatusReads || [];
    els.ioList.innerHTML = `<div class="plc-two-column">
      <div class="plc-section-box"><h3>Modules</h3>${modules.length ? modules.map((module) => `<div class="plc-row"><strong>${esc(module.name)}</strong><small>Slot ${esc(module.slot ?? "?")} • Parent ${esc(module.parent ?? "?")}${module.address ? ` • Address ${esc(module.address)}` : ""}</small>${rowButton("module", module.name)}</div>`).join("") : `<div class="plc-empty">No MODULE blocks recognized.</div>`}</div>
      <div class="plc-section-box"><h3>MODULE GSV reads</h3>${gsv.length ? gsv.map((read, index) => `<div class="plc-row"><strong>${esc(read.instance || "MODULE")}.${esc(read.attribute || "status")}</strong><code>${esc(read.destination || "no destination")}</code><small>${esc(read.routine || "?")} rung ${esc(read.rung)}</small>${rowButton("module-status", String(index))}</div>`).join("") : `<div class="plc-empty">No GSV(MODULE...) calls recognized.</div>`}</div>
    </div>
    <div class="plc-two-column"><div class="plc-section-box"><h3>I/O references</h3><div class="plc-chip-row">${(project.ioReferences || []).slice(0, 250).map((value) => `<span class="plc-chip">${esc(value)}</span>`).join("") || `<span class="plc-empty">No direct Local/remote I/O references recognized.</span>`}</div>${(project.ioReferences || []).length > 250 ? `<small>Showing first 250 of ${esc(project.ioReferences.length)} references.</small>` : ""}</div><div class="plc-section-box"><h3>Alias declarations</h3>${aliases.length ? aliases.slice(0, 250).map((tag) => `<div class="plc-row"><code>${esc(tag.name)} → ${esc(tag.aliasFor)}</code><small>Line ${esc(tag.line)}</small></div>`).join("") : `<div class="plc-empty">No alias declarations recognized.</div>`}</div></div>`;
  }

  function renderMotion() {
    const project = state.project;
    const axes = project.axes || [];
    const refs = project.motionReferences || [];
    els.motionList.innerHTML = `<div class="plc-two-column"><div class="plc-section-box"><h3>Axis declarations</h3>${axes.length ? axes.map((axis) => `<div class="plc-row"><strong>${esc(axis.name)}</strong><code>${esc(axis.dataType || "axis")}</code><small>Line ${esc(axis.line || "?")}</small>${rowButton("axis", axis.name)}</div>`).join("") : `<div class="plc-empty">No explicit axis tag declarations recognized.</div>`}</div><div class="plc-section-box"><h3>Motion/status references</h3>${refs.length ? refs.slice(0, 250).map((ref) => `<div class="plc-row"><div class="plc-row-head"><strong>${esc(ref.instruction || "STATUS")}</strong><code>${esc(ref.axis || ref.source || "")}${ref.member ? `.${esc(ref.member)}` : ""}</code></div><small>${ref.routine ? `${esc(ref.routine)} rung ${esc(ref.rung)}` : "source status reference"}</small></div>`).join("") : `<div class="plc-empty">No common motion instructions or Axis.* status references recognized.</div>`}</div></div>`;
  }

  function renderFindings() {
    const findings = state.project.findings || [];
    els.findingList.innerHTML = findings.length ? `<div class="plc-list">${findings.map((finding) => `<div class="plc-row plc-finding" data-severity="${esc(finding.severity || "info")}"><div class="plc-row-head"><strong>${esc(finding.title)}</strong><span class="plc-evidence-label">${esc(finding.classification)}</span></div><small>${esc(finding.summary)}</small>${rowButton("finding", finding.id, "Review evidence")}</div>`).join("")}</div>` : `<div class="plc-empty">No discrepancy/review rules fired on the parsed source.</div>`;
  }

  function search() {
    if (!state.project) return;
    const query = els.searchInput.value.trim();
    const matches = core.searchAnalysis(state.project, query, 50);
    els.searchCount.textContent = query ? `${matches.length} result${matches.length === 1 ? "" : "s"}` : "";
    els.searchResults.innerHTML = matches.length ? matches.map((match) => `<button type="button" class="plc-search-result" data-plc-search-type="${esc(match.type)}" data-plc-search-key="${esc(match.key)}"><span class="plc-result-type">${esc(match.type)}</span><strong class="plc-result-title">${esc(match.title)}</strong><span class="plc-result-score">${esc(match.score)}</span></button>`).join("") : (query ? `<div class="plc-empty">No indexed source evidence matched “${esc(query)}”.</div>` : "");
  }

  function rawSearch() {
    if (!state.project) return;
    const query = els.rawSearchInput.value.trim().toLowerCase();
    if (!query) { els.rawSearchResults.innerHTML = ""; return; }
    const matches = (state.project.rungs || []).filter((rung) => rung.source.toLowerCase().includes(query)).slice(0, 100);
    els.rawSearchResults.innerHTML = matches.length ? `<div class="plc-list">${matches.map((rung) => `<div class="plc-row"><strong>${esc(rung.program || "?")} / ${esc(rung.routine || "?")} / rung ${esc(rung.number)}</strong><small>Source line ${esc(rung.startLine)}</small><code>${esc(rung.source.slice(0, 700))}${rung.source.length > 700 ? "…" : ""}</code>${rowButton("rung", `${rung.program || ""}/${rung.routine || ""}/${rung.number}`)}</div>`).join("")}</div>` : `<div class="plc-empty">No rung source contains “${esc(query)}”.</div>`;
  }

  function findRecord(type, key) {
    const project = state.project;
    if (!project) return null;
    if (type === "fault") return (project.faultWriters || []).find((item) => item.target === key) || null;
    if (type === "timer") return (project.timers || []).find((item) => item.tag === key) || null;
    if (type === "counter") return (project.counters || []).find((item) => item.tag === key) || null;
    if (type === "module") return (project.modules || []).find((item) => item.name === key) || null;
    if (type === "axis") return (project.axes || []).find((item) => item.name === key) || null;
    if (type === "finding") return (project.findings || []).find((item) => item.id === key) || null;
    if (type === "module-status") {
      const byIndex = Number(key);
      if (Number.isInteger(byIndex) && project.moduleStatusReads?.[byIndex]) return project.moduleStatusReads[byIndex];
      return (project.moduleStatusReads || []).find((item) => item.destination === key || item.instance === key) || null;
    }
    if (type === "rung") return (project.rungs || []).find((rung) => `${rung.program || ""}/${rung.routine || ""}/${rung.number}` === key) || null;
    return null;
  }

  function sourceBlocks(record) {
    const blocks = [];
    if (record?.writers) record.writers.forEach((writer) => blocks.push({ title: `${writer.instruction} • ${writer.program || "?"}/${writer.routine || "?"}/rung ${writer.rung}`, source: writer.source, line: writer.line }));
    if (record?.resets) record.resets.forEach((reset) => blocks.push({ title: `${reset.instruction} reset • ${reset.program || "?"}/${reset.routine || "?"}/rung ${reset.rung}`, source: reset.source, line: reset.line }));
    if (record?.instructions && !record?.writers) record.instructions.forEach((item) => blocks.push({ title: `${item.type} • ${item.program || "?"}/${item.routine || "?"}/rung ${item.rung}`, source: item.source, line: item.line }));
    if (record?.source && typeof record.source === "string") blocks.push({ title: "Source", source: record.source, line: record.line || record.startLine });
    if (record?.raw) blocks.push({ title: "Declaration", source: record.raw, line: record.line || record.startLine });
    if (record?.evidence) blocks.push({ title: "Finding evidence", source: JSON.stringify(record.evidence, null, 2), line: null });
    return blocks;
  }

  function openDetail(type, key) {
    const record = findRecord(type, key);
    if (!record) return;
    let title = key;
    if (type === "finding") title = record.title;
    else if (record.tag) title = record.tag;
    else if (record.name) title = record.name;
    else if (record.target) title = record.target;
    else if (type === "rung") title = `${record.routine || "Routine"} rung ${record.number}`;
    els.detailTitle.textContent = title;
    const chain = core.summarizeLogicChain(record);
    const cards = [];
    if (record.target) cards.push(["Target", record.target]);
    if (record.writerCount != null) cards.push(["Writers", record.writerCount]);
    if (record.resets) cards.push(["Reset paths", record.resets.length]);
    if (record.presetValues) cards.push(["Numeric PRE evidence", record.presetValues.length ? record.presetValues.join(", ") : "None extracted"]);
    if (record.dataType) cards.push(["Data type", record.dataType]);
    if (record.slot != null) cards.push(["Module slot", record.slot ?? "?"]);
    if (record.classification) cards.push(["Evidence class", record.classification]);
    if (record.severity) cards.push(["Review level", record.severity]);
    const chainMarkup = chain.length ? `<div class="plc-section-box"><h3>Logic chain</h3>${chain.map((item) => `<div class="plc-row"><strong>${esc(item.kind)} • ${esc(item.location)}</strong><small>Source line ${esc(item.line || "?")}</small><div class="plc-chip-row">${(item.symbols || []).slice(0, 40).map((symbol) => `<span class="plc-chip">${esc(symbol)}</span>`).join("")}</div></div>`).join("")}</div>` : "";
    const blocks = sourceBlocks(record);
    const sourceMarkup = blocks.length ? blocks.map((block) => `<div class="plc-detail-source"><strong>${esc(block.title)}${block.line ? ` • line ${esc(block.line)}` : ""}</strong><pre>${esc(block.source)}</pre></div>`).join("") : `<div class="plc-empty">No raw source excerpt is attached to this record.</div>`;
    els.detailBody.innerHTML = `${cards.length ? `<div class="plc-detail-grid">${cards.map(([label, value]) => `<div class="plc-detail-card"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join("")}</div>` : ""}${record.summary ? `<div class="plc-warning">${esc(record.summary)}</div>` : ""}${chainMarkup}<div class="plc-section-box"><h3>Source evidence</h3>${sourceMarkup}</div>`;
    els.detailPanel.hidden = false;
    els.detailPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function selectTab(name) {
    document.querySelectorAll("[data-plc-tab]").forEach((button) => {
      const active = button.dataset.plcTab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll("[data-plc-panel]").forEach((panel) => { panel.hidden = panel.dataset.plcPanel !== name; });
  }

  function cacheElements() {
    Object.assign(els, {
      fileInput: id("plcFileInput"), dropZone: id("plcDropZone"), selectedFile: id("plcSelectedFile"), fileStatus: id("plcFileStatus"),
      analyzeButton: id("plcAnalyzeButton"), clearButton: id("plcClearButton"), results: id("plcResults"), controllerName: id("plcControllerName"),
      analysisStatus: id("plcAnalysisStatus"), summaryCards: id("plcSummaryCards"), searchInput: id("plcSearchInput"), searchButton: id("plcSearchButton"),
      searchResults: id("plcSearchResults"), searchCount: id("plcSearchCount"), projectStructure: id("plcProjectStructure"), faultList: id("plcFaultList"),
      timerList: id("plcTimerList"), ioList: id("plcIoList"), motionList: id("plcMotionList"), findingList: id("plcFindingList"),
      rawSearchInput: id("plcRawSearchInput"), rawSearchButton: id("plcRawSearchButton"), rawSearchResults: id("plcRawSearchResults"),
      detailPanel: id("plcDetailPanel"), detailTitle: id("plcDetailTitle"), detailBody: id("plcDetailBody"), detailClose: id("plcDetailClose")
    });
  }

  function install() {
    cacheElements();
    els.dropZone.addEventListener("click", () => els.fileInput.click());
    els.dropZone.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.fileInput.click(); } });
    els.fileInput.addEventListener("change", () => chooseDroppedFile(els.fileInput.files));
    ["dragenter", "dragover"].forEach((type) => els.dropZone.addEventListener(type, (event) => { event.preventDefault(); els.dropZone.classList.add("is-dragover"); }));
    ["dragleave", "drop"].forEach((type) => els.dropZone.addEventListener(type, (event) => { event.preventDefault(); els.dropZone.classList.remove("is-dragover"); }));
    els.dropZone.addEventListener("drop", (event) => chooseDroppedFile(event.dataTransfer?.files));
    els.analyzeButton.addEventListener("click", analyze);
    els.clearButton.addEventListener("click", () => { state.worker?.terminate(); state.worker = null; els.fileInput.value = ""; setFile(null); });
    els.searchButton.addEventListener("click", search);
    els.searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") search(); });
    els.rawSearchButton.addEventListener("click", rawSearch);
    els.rawSearchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") rawSearch(); });
    els.detailClose.addEventListener("click", () => { els.detailPanel.hidden = true; });
    document.addEventListener("click", (event) => {
      const tab = event.target.closest("[data-plc-tab]");
      if (tab) { selectTab(tab.dataset.plcTab); return; }
      const open = event.target.closest("[data-plc-open-type]");
      if (open) { openDetail(open.dataset.plcOpenType, open.dataset.plcOpenKey); return; }
      const result = event.target.closest("[data-plc-search-type]");
      if (result) openDetail(result.dataset.plcSearchType, result.dataset.plcSearchKey);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})(window);