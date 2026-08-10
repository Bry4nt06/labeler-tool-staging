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
        width: 100%;
        max-width: 100%;
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

      /* Specs stay inside the normal workspace width. Compact the table
         itself instead of widening the entire right workspace and squeezing
         the mechanical map. */
      #specs .spec-section th,
      #specs .spec-section td,
      #specs .spec-section .num {
        text-align: center !important;
        vertical-align: middle;
      }

      #specs .spec-section input,
      #specs .spec-section select {
        width: 100%;
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
        padding: 4px 5px;
        text-align: center;
      }

      #specs .spec-section select {
        text-align-last: center;
      }

      #specs #bottleSpecs > table {
        min-width: 0;
        table-layout: fixed;
      }

      #specs #bottleSpecs th:nth-child(1),
      #specs #bottleSpecs td:nth-child(1) { width: 30px; }
      #specs #bottleSpecs th:nth-child(2),
      #specs #bottleSpecs td:nth-child(2) { width: 150px; }
      #specs #bottleSpecs th:nth-child(3),
      #specs #bottleSpecs td:nth-child(3),
      #specs #bottleSpecs th:nth-child(4),
      #specs #bottleSpecs td:nth-child(4),
      #specs #bottleSpecs th:nth-child(5),
      #specs #bottleSpecs td:nth-child(5),
      #specs #bottleSpecs th:nth-child(6),
      #specs #bottleSpecs td:nth-child(6) { width: 104px; }
      #specs #bottleSpecs th:last-child,
      #specs #bottleSpecs td:last-child { width: 74px; }

      #specs #labelSpecs > .label-specs-table {
        width: 100%;
        min-width: 0 !important;
        max-width: 100%;
        table-layout: fixed;
      }

      #specs .label-specs-table .label-col-id { width: 28px; }
      #specs .label-specs-table .label-col-brand { width: 110px; }
      #specs .label-specs-table .label-col-spec { width: 60px; }
      #specs .label-specs-table .label-col-application { width: 64px; }
      #specs .label-specs-table .label-col-short { width: 58px; }
      #specs .label-specs-table .label-col-neck-height { width: 62px; }
      #specs .label-specs-table .label-col-neck-length { width: 62px; }
      #specs .label-specs-table .label-col-curve { width: 72px; }
      #specs .label-specs-table .label-col-circ { width: 72px; }
      #specs .label-specs-table .label-col-code { width: 105px; }
      #specs .label-specs-table .label-col-action { width: 76px; }

      #specs .label-specs-table th {
        padding-inline: 3px;
        font-size: 11px;
        line-height: 1.1;
        white-space: normal;
      }

      #specs .label-specs-table td {
        padding-inline: 3px;
      }

      #specs tr.selected-brand-spec > td {
        position: relative;
        background:
          linear-gradient(
            90deg,
            color-mix(in srgb, var(--accent, var(--green)) 22%, var(--panel)) 0%,
            color-mix(in srgb, var(--accent, var(--green)) 12%, var(--panel)) 58%,
            color-mix(in srgb, var(--accent, var(--green)) 7%, var(--panel)) 100%
          );
        background-clip: padding-box;
        border-top: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
        border-bottom: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
      }

      #specs tr.selected-brand-spec > td:first-child {
        border-left: 4px solid var(--accent, var(--green));
        box-shadow: inset 7px 0 14px color-mix(in srgb, var(--accent, var(--green)) 18%, transparent);
      }

      #specs tr.selected-brand-spec > td:last-child {
        border-right: 1px solid color-mix(in srgb, var(--accent, var(--green)) 72%, var(--line));
      }

      #specs tr.selected-brand-spec input,
      #specs tr.selected-brand-spec select {
        border-color: var(--line);
        background: color-mix(in srgb, var(--input) 88%, transparent);
        box-shadow: none;
      }

      #specs tr.selected-brand-spec input:focus,
      #specs tr.selected-brand-spec select:focus {
        border-color: var(--accent, var(--green));
        box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, var(--green)) 24%, transparent);
      }

      #specs .spec-row-actions {
        display: flex !important;
        flex-wrap: nowrap !important;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: auto;
        max-width: 100%;
        min-width: 0;
        white-space: nowrap;
      }

      #specs .spec-row-actions > .spec-icon-button {
        display: inline-flex;
        flex: 0 0 32px;
        align-items: center;
        justify-content: center;
        width: 32px;
        max-width: 32px;
        min-width: 32px;
        height: 30px;
        min-height: 30px;
        margin: 0;
        padding: 5px;
      }

      @media (max-width: 760px) {
        /* The Specs sheet itself must not compete with its tables for the
           horizontal swipe. Each rendered spec table owns its own x-axis so
           iOS can pan across inputs without moving or clipping the page. */
        #specs.table-wrap {
          overflow: visible;
          max-width: 100%;
          min-width: 0;
        }

        #specs .spec-stack,
        #specs .spec-section {
          width: 100%;
          max-width: 100%;
          min-width: 0;
        }

        #specs #bottleSpecs,
        #specs #labelSpecs {
          display: block;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          touch-action: pan-x pan-y;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 8px;
        }

        #specs #bottleSpecs > table,
        #specs #labelSpecs > table {
          width: max-content;
          min-width: max-content !important;
          max-width: none;
        }

        #specs #bottleSpecs input,
        #specs #bottleSpecs select,
        #specs #labelSpecs input,
        #specs #labelSpecs select {
          touch-action: pan-x pan-y;
        }
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
