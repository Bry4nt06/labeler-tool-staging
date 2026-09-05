"use strict";

(function installDependencyTraceUI(global) {
  const core = global.ServoForgeL5KAnalyzer;
  if (!core || typeof core.traceTarget !== "function") throw new Error("ServoForge PLC dependency analyzer did not load.");

  const state = {
    project: null,
    fileKey: null,
    worker: null,
    analyzing: false
  };

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const id = (name) => document.getElementById(name);

  function currentFile() {
    return id("plcFileInput")?.files?.[0] || null;
  }

  function fileKey(file) {
    return file ? `${file.name}|${file.size}|${file.lastModified}` : null;
  }

  function setStatus(message, kind = "") {
    const el = id("plcDependencyStatus");
    if (!el) return;
    el.textContent = message;
    el.dataset.status = kind;
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Unable to read the selected L5K file."));
      reader.readAsText(file);
    });
  }

  function parseInWorker(text, file) {
    return new Promise((resolve, reject) => {
      let worker;
      try { worker = new Worker("./l5k-analyzer-worker.js?v=5"); }
      catch { worker = null; }
      if (!worker) {
        try { resolve(core.parseL5K(text, { fileName: file.name, byteLength: file.size })); }
        catch (error) { reject(error); }
        return;
      }
      state.worker = worker;
      worker.onmessage = (event) => {
        const payload = event.data || {};
        worker.terminate();
        state.worker = null;
        if (payload.type === "result") resolve(payload.project);
        else reject(new Error(payload.message || "Dependency analysis worker failed."));
      };
      worker.onerror = (event) => {
        worker.terminate();
        state.worker = null;
        reject(new Error(event.message || "Dependency analysis worker failed."));
      };
      worker.postMessage({ type: "analyze", text, fileName: file.name, byteLength: file.size });
    });
  }

  function summaryCard(label, value) {
    return `<div class="plc-summary-card"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function renderIndex() {
    const project = state.project;
    const deps = project?.dependencies;
    if (!deps) return;
    const stats = deps.statistics || {};
    id("plcDependencySummary").innerHTML = [
      summaryCard("UDT definitions", stats.dataTypes || 0),
      summaryCard("UDT members", stats.dataTypeMembers || 0),
      summaryCard("Routine calls", stats.routineCalls || 0),
      summaryCard("Programs with MAIN", stats.programsWithMainRoutine || 0),
      summaryCard("AOI definitions", stats.aoiDefinitions || 0),
      summaryCard("AOI calls", stats.aoiCalls || 0),
      summaryCard("Write relations", stats.writeRelations || 0)
    ].join("");

    const faults = project.faultWriters || [];
    id("plcDependencyTargets").innerHTML = faults.length
      ? faults.slice(0, 120).map((fault) => `<button type="button" class="plc-chip plc-dependency-target" data-dependency-target="${esc(fault.target)}">${esc(fault.target)}</button>`).join(" ")
      : `<span class="plc-empty">No fault-like targets were indexed.</span>`;

    const options = new Set();
    for (const fault of faults) options.add(fault.target);
    for (const relation of deps.writeRelations || []) options.add(relation.destination);
    for (const tag of deps.scopedTags || []) options.add(tag.name);
    id("plcDependencyTargetOptions").innerHTML = [...options].slice(0, 5000).map((value) => `<option value="${esc(value)}"></option>`).join("");

    const dataTypes = deps.dataTypes || [];
    id("plcDependencyTypes").innerHTML = dataTypes.length
      ? dataTypes.slice(0, 100).map((item) => `<div class="plc-row"><div class="plc-row-head"><strong>${esc(item.name)}</strong><span class="plc-chip">${esc(item.members.length)} members</span></div><small>Definition line ${esc(item.line || "?")}</small><div class="plc-chip-row">${item.members.slice(0, 20).map((member) => `<span class="plc-chip">${esc(member.name)} : ${esc(member.dataType)}</span>`).join("")}${item.members.length > 20 ? `<span class="plc-chip">+${esc(item.members.length - 20)} more</span>` : ""}</div></div>`).join("")
      : `<div class="plc-empty">No DATATYPE definitions were found in this export.</div>`;

    const calls = deps.routineCalls || [];
    id("plcDependencyCalls").innerHTML = calls.length
      ? calls.slice(0, 150).map((call) => `<div class="plc-row"><strong>${esc(call.callerRoutine || "?")} → ${esc(call.calleeRoutine)}</strong><small>${esc(call.program || "?")} • rung ${esc(call.rung)} • source line ${esc(call.line || "?")}</small></div>`).join("")
      : `<div class="plc-empty">No JSR routine calls were found.</div>`;

    const aois = deps.aoiDefinitions || [];
    id("plcDependencyAOIs").innerHTML = aois.length
      ? aois.map((item) => `<div class="plc-row"><div class="plc-row-head"><strong>${esc(item.name)}</strong><span class="plc-chip">${esc(item.parameters.length)} parameters</span></div><small>Definition line ${esc(item.line || "?")} • ${(deps.aoiCalls || []).filter((call) => call.definition === item.name).length} call(s) located</small></div>`).join("")
      : `<div class="plc-empty">No ADD_ON_INSTRUCTION_DEFINITION blocks were found. This does not indicate a problem; many older projects contain no AOIs.</div>`;

    setStatus(`Dependency index ready • ${stats.routineCalls || 0} routine calls • ${stats.dataTypes || 0} UDT definitions.`, "pass");
  }

  async function buildIndex(force = false) {
    const file = currentFile();
    if (!file) {
      setStatus("Choose an L5K file first.", "caution");
      return;
    }
    const key = fileKey(file);
    if (!force && state.project && state.fileKey === key) return;
    if (state.analyzing) return;
    state.analyzing = true;
    setStatus(`Building dependency index for ${file.name}…`, "loading");
    try {
      const text = await readFile(file);
      const project = await parseInWorker(text, file);
      state.project = project;
      state.fileKey = key;
      renderIndex();
    } catch (error) {
      console.error(error);
      state.project = null;
      state.fileKey = null;
      setStatus(`Dependency analysis failed: ${error?.message || error}`, "error");
    } finally {
      state.analyzing = false;
    }
  }

  function executionPathMarkup(trace) {
    const groups = trace.executionPaths || [];
    if (!groups.length) return `<div class="plc-empty">No JSR caller path was required or located for the traced writers.</div>`;
    return groups.map((group) => `<div class="plc-row"><strong>${esc(group.routine)}</strong>${(group.paths || []).slice(0, 12).map((path) => `<div class="plc-chip-row">${path.map((step) => `<span class="plc-chip"${step.cycle ? ` title="Call cycle detected"` : ""}>${esc(step.routine || "?")}${step.root ? " (MAIN)" : ""}${step.unlocatedCaller ? " (caller not located)" : ""}${step.cycle ? " (cycle)" : ""}</span>`).join(" → ")}</div>`).join("")}</div>`).join("");
  }

  function renderTrace(trace) {
    const nodes = trace.nodes || [];
    const edges = trace.edges || [];
    const writers = new Map((trace.writers || []).map((writer) => [writer.id, writer]));
    const nodeRows = nodes.slice(0, 250).map((node) => {
      const typeBits = [node.kind, node.dataType, node.memberDataType, node.dataTypeDefinition, node.aoiDefinition].filter(Boolean);
      return `<div class="plc-row plc-dependency-node" data-depth="${esc(node.depth)}"><div class="plc-row-head"><strong><code>${esc(node.symbol)}</code></strong><span class="plc-chip">depth ${esc(node.depth)}</span></div><small>${esc(typeBits.join(" • ") || "source symbol")}${node.scope ? ` • scope ${esc(node.scope)}` : ""}${node.cycle ? " • cycle encountered" : ""}</small></div>`;
    }).join("");
    const edgeRows = edges.slice(0, 250).map((edge) => {
      const writer = writers.get(edge.writerId);
      return `<div class="plc-row"><div class="plc-row-head"><code>${esc(edge.from)}</code><span>→</span><code>${esc(edge.to)}</code></div><small>${esc(edge.program || "?")} / ${esc(edge.routine || "?")} / rung ${esc(edge.rung)} • line ${esc(edge.line || "?")}${writer ? ` • ${esc(writer.instruction)}` : ""}</small>${writer ? `<details><summary>Source rung</summary><pre>${esc(writer.source)}</pre></details>` : ""}</div>`;
    }).join("");
    const aoiRows = (trace.aoiContexts || []).map((context) => `<div class="plc-row"><strong>${esc(context.instanceTag)} : ${esc(context.definition)}</strong><small>${esc(context.symbol)} • ${esc(context.calls.length)} AOI invocation(s) located</small></div>`).join("");

    id("plcDependencyTraceResults").innerHTML = `<div class="plc-warning"><strong>Static source trace:</strong> ${esc(trace.note)}</div>
      <div class="plc-detail-grid">
        <div class="plc-detail-card"><small>Target</small><strong>${esc(trace.target)}</strong></div>
        <div class="plc-detail-card"><small>Dependency nodes</small><strong>${esc(nodes.length)}</strong></div>
        <div class="plc-detail-card"><small>Source edges</small><strong>${esc(edges.length)}</strong></div>
        <div class="plc-detail-card"><small>Writer rungs</small><strong>${esc((trace.writers || []).length)}</strong></div>
      </div>
      ${trace.truncated ? `<div class="plc-warning">Trace reached its safety limit (${esc(trace.limits.maxNodes)} nodes / depth ${esc(trace.limits.maxDepth)}). Narrow the target or review source directly.</div>` : ""}
      <div class="plc-section-box"><h3>Upstream symbols</h3>${nodeRows || `<div class="plc-empty">No upstream write relationship was located for this exact target.</div>`}</div>
      <div class="plc-section-box"><h3>Source relationships</h3>${edgeRows || `<div class="plc-empty">No source-reference edges were located.</div>`}</div>
      <div class="plc-section-box"><h3>Routine execution paths</h3>${executionPathMarkup(trace)}</div>
      ${aoiRows ? `<div class="plc-section-box"><h3>AOI context</h3>${aoiRows}</div>` : ""}`;
  }

  async function traceSelected() {
    await buildIndex(false);
    if (!state.project) return;
    const target = id("plcDependencyTargetInput").value.trim();
    if (!target) {
      setStatus("Enter or choose a target to trace.", "caution");
      return;
    }
    try {
      const trace = core.traceTarget(state.project, target, { maxDepth: 6, maxNodes: 300 });
      renderTrace(trace);
      setStatus(`Trace complete for ${target}.`, "pass");
    } catch (error) {
      setStatus(`Trace failed: ${error?.message || error}`, "error");
    }
  }

  function injectUI() {
    const tabList = document.querySelector(".plc-tab-list");
    const workspace = document.querySelector(".plc-workspace");
    if (!tabList || !workspace || id("plcTabDependencies")) return;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "plc-tab";
    tab.dataset.plcTab = "dependencies";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.textContent = "Dependencies";
    const findingsTab = tabList.querySelector('[data-plc-tab="findings"]');
    if (findingsTab) tabList.insertBefore(tab, findingsTab);
    else tabList.appendChild(tab);

    const panel = document.createElement("section");
    panel.id = "plcTabDependencies";
    panel.className = "panel plc-tab-panel";
    panel.dataset.plcPanel = "dependencies";
    panel.hidden = true;
    panel.innerHTML = `<div class="sf-section-heading"><div><span class="sf-eyebrow">PHASE 5</span><h2>Source dependency trace</h2></div><span id="plcDependencyStatus" class="plc-status" aria-live="polite">Open this tab to build the dependency index.</span></div>
      <p class="panel-help">Trace an exact fault/output/tag backward through writer rungs, intermediate symbols, UDT members, JSR routine calls and AOI instances. This is offline static analysis; it does not prove live machine state.</p>
      <div id="plcDependencySummary" class="plc-summary-grid"></div>
      <div class="plc-section-box"><h3>Trace a target</h3><div class="plc-search-row"><input id="plcDependencyTargetInput" type="search" spellcheck="false" list="plcDependencyTargetOptions" placeholder="Faults[1].13, IntermediateStatus, Axis.Status..." /><datalist id="plcDependencyTargetOptions"></datalist><button id="plcDependencyTraceButton" type="button">Trace dependencies</button><button id="plcDependencyRebuildButton" type="button" class="secondary-button">Rebuild index</button></div><div id="plcDependencyTargets" class="plc-chip-row"></div></div>
      <div id="plcDependencyTraceResults"></div>
      <div class="plc-two-column"><div class="plc-section-box"><h3>Routine-call inventory</h3><div id="plcDependencyCalls"></div></div><div class="plc-section-box"><h3>AOI definitions</h3><div id="plcDependencyAOIs"></div></div></div>
      <div class="plc-section-box"><h3>UDT / DATATYPE definitions</h3><div id="plcDependencyTypes"></div></div>`;
    const findingsPanel = workspace.querySelector('[data-plc-panel="findings"]');
    if (findingsPanel) workspace.insertBefore(panel, findingsPanel);
    else workspace.appendChild(panel);

    id("plcDependencyTraceButton").addEventListener("click", traceSelected);
    id("plcDependencyRebuildButton").addEventListener("click", () => buildIndex(true));
    id("plcDependencyTargetInput").addEventListener("keydown", (event) => { if (event.key === "Enter") traceSelected(); });
    panel.addEventListener("click", (event) => {
      const target = event.target.closest("[data-dependency-target]");
      if (!target) return;
      id("plcDependencyTargetInput").value = target.dataset.dependencyTarget;
      traceSelected();
    });
    document.addEventListener("click", (event) => {
      const dependencyTab = event.target.closest('[data-plc-tab="dependencies"]');
      if (dependencyTab) global.setTimeout(() => buildIndex(false), 0);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectUI, { once: true });
  else injectUI();
})(window);
