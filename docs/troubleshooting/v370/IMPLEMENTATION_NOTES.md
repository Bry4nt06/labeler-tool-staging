# v370 implementation notes

- Troubleshooting permanent records remain universal/machine-family knowledge.
- CO85 reference inventory remains useful for source auditing, but Import Assistant no longer requires a CO85 controller mapping to analyze another site's L5K.
- Source status remains required.
- Optional site/line, machine/asset, and controller-purpose fields are carried only as local context.
- Analyzer review candidates can be compacted into a session-only PLC overlay and carried to Troubleshooter.
- The overlay is stored in `sessionStorage` under `servoforge.troubleshooting.plcOverlay.v1`.
- Troubleshooter search can resolve exact local targets and writer/upstream symbols from the overlay.
- Overlay records are clearly categorized as `Uploaded PLC / Site overlay` and state that local tags are not universal definitions.
- Clearing the overlay or ending the browser session removes the local evidence.
- Cache keys are advanced for the modified Import Assistant controller UI and Troubleshooter search-precedence layer.
