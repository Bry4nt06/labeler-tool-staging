"use strict";

(function installServoProgramEightRowGrouping(global) {
  if (global.LabelerServoProgramEightRowGrouping?.installed) return;

  const BUTTON_ID = "printServoProgram";
  const STYLE_ID = "servo-program-eight-row-grouping-style";
  const GROUP_SIZE = 8;
  let buttonObserver = null;

  function printApi() {
    return global.LabelerServoProgramPrint || null;
  }

  function expectedDividerCount(rowCount) {
    const count = Math.max(0, Number(rowCount) || 0);
    return count > 0 ? Math.floor((count - 1) / GROUP_SIZE) : 0;
  }

  function groupedPrintHtml(sourceHtml) {
    const parser = new DOMParser();
    const documentModel = parser.parseFromString(String(sourceHtml || ""), "text/html");
    const body = documentModel.querySelector(".program-section tbody");
    if (!body) return sourceHtml;

    body.querySelectorAll("tr.hmi-group-divider").forEach((row) => row.remove());
    const rows = [...body.querySelectorAll(":scope > tr")];
    rows.forEach((row, index) => {
      if ((index + 1) % GROUP_SIZE !== 0 || index >= rows.length - 1) return;
      const divider = documentModel.createElement("tr");
      divider.className = "hmi-group-divider";
      divider.setAttribute("aria-hidden", "true");
      const cell = documentModel.createElement("td");
      cell.colSpan = 11;
      divider.appendChild(cell);
      row.insertAdjacentElement("afterend", divider);
    });

    const style = documentModel.createElement("style");
    style.textContent = `
      .program-section tbody tr.hmi-group-divider td {
        height: 6px !important;
        min-height: 6px !important;
        padding: 0 !important;
        border: 0 !important;
        background: #ffffff !important;
      }
      @media print {
        .program-section tbody tr.hmi-group-divider td {
          height: 5px !important;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      }
    `;
    documentModel.head.appendChild(style);

    return `<!doctype html>\n${documentModel.documentElement.outerHTML}`;
  }

  function openGroupedPrintView() {
    const api = printApi();
    if (!api?.printModel || !api?.printHtml) return false;
    const model = api.printModel();
    if (!Array.isArray(model?.rows) || !model.rows.length) {
      global.alert?.("Build the Servo Program before printing.");
      return false;
    }

    const printWindow = global.open("", "ServoForgeServoProgramPrint", "width=1440,height=920,scrollbars=yes,resizable=yes");
    if (!printWindow) {
      global.alert?.("The browser blocked the print window. Allow pop-ups for ServoForge, then try Print Program again.");
      return false;
    }

    const html = groupedPrintHtml(api.printHtml(model));
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus?.();
    global.setTimeout(() => {
      try { printWindow.print?.(); } catch { }
    }, 250);
    return true;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}.servo-program-print-action.servo-program-print-icon {
        width: 32px;
        min-width: 32px;
        max-width: 32px;
        height: 30px;
        min-height: 30px;
        padding: 0;
        margin-left: 4px;
        display: inline-grid;
        place-items: center;
        line-height: 1;
        border-radius: 6px;
      }
      #${BUTTON_ID}.servo-program-print-icon svg {
        width: 15px;
        height: 15px;
        display: block;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.9;
        stroke-linecap: round;
        stroke-linejoin: round;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function enhanceButton() {
    const current = document.getElementById(BUTTON_ID);
    if (!current || current.dataset.compactPrintIcon === "true") return Boolean(current);

    ensureStyles();
    const button = current.cloneNode(false);
    button.id = BUTTON_ID;
    button.type = "button";
    button.className = `${current.className} servo-program-print-icon`.trim();
    button.hidden = current.hidden;
    button.disabled = current.disabled;
    button.dataset.compactPrintIcon = "true";
    button.setAttribute("aria-label", "Print Program");
    button.title = "Print Servo Program";
    button.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 8V3h10v5" />
        <path d="M7 17H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v7H7z" />
        <path d="M17.5 11h.01" />
      </svg>`;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openGroupedPrintView();
    });
    current.replaceWith(button);
    printApi()?.syncButton?.();
    return true;
  }

  function install() {
    if (enhanceButton()) return;
    if (typeof MutationObserver !== "function") return;
    buttonObserver?.disconnect?.();
    buttonObserver = new MutationObserver(() => {
      if (enhanceButton()) buttonObserver?.disconnect?.();
    });
    buttonObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }

  global.LabelerServoProgramEightRowGrouping = Object.freeze({
    installed: true,
    version: 1,
    groupSize: GROUP_SIZE,
    expectedDividerCount,
    groupedPrintHtml,
    openGroupedPrintView,
    enhanceButton
  });
})(typeof window !== "undefined" ? window : globalThis);
