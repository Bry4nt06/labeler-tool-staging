"use strict";

(function installSpecificationTableUiController(global) {
  if (global.LabelerSpecificationTableUiController?.installed) return;

  const STYLE_ID = "specificationTableUiStyles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #specs .spec-section table {
        border-collapse: separate;
        border-spacing: 0;
      }

      #specs .spec-section table thead th {
        position: sticky;
        top: 0;
        z-index: 12;
        background: var(--panel-hi);
        background-clip: padding-box;
        box-shadow: inset 0 -1px 0 var(--line), 0 7px 14px rgba(0, 0, 0, 0.24);
      }

      #specs .spec-section table thead th:first-child {
        box-shadow: inset 1px 0 0 var(--line), inset 0 -1px 0 var(--line), 0 7px 14px rgba(0, 0, 0, 0.24);
      }

      #specs tr.selected-brand-spec > td {
        background:
          linear-gradient(rgba(65, 200, 137, 0.17), rgba(65, 200, 137, 0.17)),
          var(--panel);
        border-top: 1px solid var(--green);
        border-bottom: 1px solid var(--green);
      }

      #specs tr.selected-brand-spec > td:first-child {
        border-left: 3px solid var(--green);
        box-shadow: inset 4px 0 12px rgba(65, 200, 137, 0.2);
      }

      #specs tr.selected-brand-spec > td:last-child {
        border-right: 1px solid var(--green);
      }

      #specs tr.selected-brand-spec input,
      #specs tr.selected-brand-spec select {
        border-color: var(--green);
        box-shadow: 0 0 0 1px rgba(65, 200, 137, 0.22);
      }

      #specs tr.selected-brand-spec td:first-child::after {
        content: "Selected";
        display: block;
        margin-top: 3px;
        color: var(--green);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
    `;
    document.head.appendChild(style);
  }

  installStyles();

  global.LabelerSpecificationTableUiController = Object.freeze({
    installed: true,
    installStyles
  });
})(window);
