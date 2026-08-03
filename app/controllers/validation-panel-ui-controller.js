"use strict";

(function installValidationPanelUiController(global) {
  if (global.LabelerValidationPanelUiController?.installed) return;

  const STYLE_ID = "servoforgeValidationPanelUiStyles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return false;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .panel.validation {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        overflow-x: hidden !important;
        overflow-y: auto !important;
      }

      .panel.validation > *,
      .validation-details,
      #validationList,
      #validationList > * {
        width: auto;
        max-width: 100%;
        min-width: 0;
      }

      .validation-head {
        display: grid !important;
        grid-template-columns: minmax(0, 1fr) !important;
        align-items: stretch !important;
        min-width: 0;
      }

      .validation-head-actions {
        display: grid !important;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        width: 100%;
        min-width: 0;
        white-space: normal !important;
      }

      .validation-head-actions .compact-builder-button {
        width: 100%;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .pipeline-validation-summary {
        display: flex !important;
        flex-wrap: wrap;
        width: 100% !important;
        max-width: 100%;
        min-width: 0;
        align-items: stretch !important;
        overflow: hidden;
      }

      .pipeline-validation-summary > strong {
        flex: 1 0 100%;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        padding-bottom: 2px;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .pipeline-validation-summary > span {
        flex: 1 1 0;
        width: auto;
        max-width: 100%;
        min-width: 0;
        white-space: normal !important;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.2;
      }

      .pipeline-validation-banner,
      .panel.validation .notice,
      .panel.validation strong,
      .panel.validation span,
      .panel.validation small {
        max-width: 100%;
        min-width: 0;
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      @media (max-width: 430px) {
        .validation-head-actions {
          grid-template-columns: 1fr;
        }

        .pipeline-validation-summary > span {
          flex-basis: 100%;
        }
      }
    `;
    document.head.appendChild(style);
    return true;
  }

  installStyles();

  global.LabelerValidationPanelUiController = Object.freeze({
    installed: true,
    installStyles
  });
})(window);
