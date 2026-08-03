"use strict";

(function installValidationPanelUiController(global) {
  if (global.LabelerValidationPanelUiController?.installed) return;

  const STYLE_ID = "servoforgeValidationPanelUiStyles";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return false;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pipeline-validation-summary {
        width: 100%;
        min-width: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        align-items: stretch !important;
        overflow: hidden;
      }

      .pipeline-validation-summary > strong {
        grid-column: 1 / -1;
        display: block;
        min-width: 0;
        padding-bottom: 2px;
        overflow-wrap: anywhere;
      }

      .pipeline-validation-summary > span {
        min-width: 0;
        width: 100%;
        white-space: normal !important;
        line-height: 1.2;
      }

      @media (max-width: 430px) {
        .pipeline-validation-summary {
          grid-template-columns: 1fr !important;
        }

        .pipeline-validation-summary > strong {
          grid-column: 1;
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
