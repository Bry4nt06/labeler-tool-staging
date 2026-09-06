"use strict";

(function installAfiUi(global) {
  const NativeWorker = global.Worker;
  let lastProject = null;
  let renderTimer = null;

  const esc = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function scheduleRender(project) {
    if (project) lastProject = project;
    global.clearTimeout(renderTimer);
    renderTimer = global.setTimeout(renderAfiUi, 0);
  }

  if (typeof NativeWorker === "function") {
    function ServoForgeAnalyzerWorker(url, options) {
      const rawUrl = String(url || "");
      const workerUrl = rawUrl.replace("l5k-analyzer-worker.js?v=11", "l5k-analyzer-worker.js?v=14");
      const worker = new NativeWorker(workerUrl, options);
      worker.addEventListener("message", (event) => {
        const payload = event.data || {};
        if (payload.type === "result" && payload.project) scheduleRender(payload.project);
      });
      return worker;
    }
    ServoForgeAnalyzerWorker.prototype = NativeWorker.prototype;
    Object.setPrototypeOf(ServoForgeAnalyzerWorker, NativeWorker);
    global.Worker = ServoForgeAnalyzerWorker;
  }

  global.addEventListener("servoforge:plc-afi-project", (event) => {
    scheduleRender(event.detail?.project || null);
  });

  function summaryCard(count) {
    return `<span>AFI instructions</span><strong>${esc(count)}</strong>`;
  }

  function afiRows(afis) {
    if (!afis.length) return `<div class="plc-empty">No AFI() instructions were located in the supplied L5K.</div>`;
    return `<div class="plc-list plc-afi-list">${afis.map((afi, index) => {
      const key = `${afi.program || ""}/${afi.routine || ""}/${afi.rung}`;
      return `<div class="plc-row plc-afi-row">
        <div class="plc-row-head"><strong>AFI ${index + 1}</strong><span class="plc-evidence-label">SOURCE-PROVEN</span></div>
        <small>${esc(afi.program || "(unscoped)")} / ${esc(afi.routine || "(unscoped)")} / rung ${esc(afi.rung)} • source line ${esc(afi.line || "?")}</small>
        <code>${esc(afi.source || "AFI()")}</code>
        <button type="button" class="secondary-button" data-plc-open-type="rung" data-plc-open-key="${esc(key)}">Open rung evidence</button>
      </div>`;
    }).join("")}</div>`;
  }

  function renderAfiUi() {
    const project = lastProject || global.ServoForgeL5KAnalyzer?.getLastAfiProject?.();
    if (!project) return;
    const afis = Array.isArray(project.afiReferences) ? project.afiReferences : [];

    const summary = document.getElementById("plcSummaryCards");
    if (summary) {
      let card = document.getElementById("plcAfiSummaryCard");
      if (!card) {
        card = document.createElement("div");
        card.id = "plcAfiSummaryCard";
        card.className = "plc-summary-card";
        summary.appendChild(card);
      }
      card.innerHTML = summaryCard(afis.length);
    }

    const structure = document.getElementById("plcProjectStructure");
    if (structure) {
      let section = document.getElementById("plcAfiAuditSection");
      if (!section) {
        section = document.createElement("div");
        section.id = "plcAfiAuditSection";
        section.className = "plc-section-box plc-afi-audit-section";
        structure.appendChild(section);
      }
      section.innerHTML = `<div class="plc-row-head"><h3>AFI audit</h3><span class="plc-chip">${esc(afis.length)} AFI${afis.length === 1 ? "" : "s"}</span></div>
        <small>${esc(project.afiAudit?.sourceBoundary || "AFI locations are source evidence only; review the surrounding rung before interpreting disabled logic.")}</small>
        ${afiRows(afis)}`;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scheduleRender(null), { once: true });
  else scheduleRender(null);
})(window);
