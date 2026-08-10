"use strict";

(function installSpecsPanelWidthIntegration(global) {
  if (global.LabelerSpecsPanelWidthIntegration?.installed) return;

  const styleId = "servoforge-specs-panel-width";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      /* Give Label Specs enough horizontal room to expose both row actions. */
      #specs.table-wrap.active {
        min-width: 0;
      }

      #labelSpecs table {
        width: 100%;
        min-width: 940px;
      }

      #labelSpecs th:last-child,
      #labelSpecs td:last-child {
        width: 82px;
        min-width: 82px;
        white-space: nowrap;
      }

      #labelSpecs td:last-child button {
        flex: 0 0 auto;
      }

      @media (min-width: 1400px) {
        .app.workspace-view-direct:has(> #specs.table-wrap.active) {
          grid-template-columns: minmax(520px, 0.72fr) minmax(900px, 1.28fr);
        }
      }
    `;
    document.head.appendChild(style);
  }

  global.LabelerSpecsPanelWidthIntegration = Object.freeze({
    installed: true,
    version: 1
  });
})(typeof window !== "undefined" ? window : globalThis);
