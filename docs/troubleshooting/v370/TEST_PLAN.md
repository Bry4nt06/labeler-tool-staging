# Troubleshooting v370 Staging Test Plan

1. Open PLC Analyzer -> Import Assistant.
2. Confirm banner says `PLC IMPORT ASSISTANT v7 — PORTABLE SITE OVERLAY`.
3. Load any full-project `.L5K` from any site.
4. Confirm `Known reference mapping` is optional and defaults to `Site-specific / not in ServoForge reference inventory`.
5. Confirm source status is still required before analysis.
6. Optionally enter site/line, machine/asset, and controller purpose.
7. Analyze and build the review queue.
8. Click `Use this controller in Troubleshooter`.
9. Confirm Troubleshooter banner says v370 and a `Site PLC overlay` panel appears.
10. Search one exact target/tag found in the uploaded PLC. Confirm the local result is labeled `Uploaded PLC / Site overlay` / `Site PLC evidence`.
11. Search a normal transferable symptom such as `bearing vibration`, `encoder feedback`, or a relevant machine symptom. Confirm normal universal/machine-family troubleshooting remains available; the local overlay must not replace the method.
12. Click `Clear carried controller`.
13. Confirm the overlay panel disappears and the local PLC-only tag no longer resolves after reload.
14. Reopen the Import Assistant and confirm clearing/new-file intake does not retain a prior site's machine identity fields.

Production must remain untouched during this validation.
