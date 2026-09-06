# Track B — Source Inventory

## Baseline

- Repository: `Bry4nt06/labeler-tool-staging`
- Exact starting commit: `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435` (`v356`)
- Working branch: `codex/v356-orientation-commissioning-gaps`
- Scope: documentation-only research and normalization. No troubleshooting records were implemented in application code.

## Source files reviewed

| Source ID | Exact filename | Coverage reviewed | Evidence retained for this track |
|---|---|---|---|
| `dartplus-11-en-000-965` | `11-EN-000-965.pdf` | pp. 22–30; pp. 49–52; p. 55 | Basic setup, calibration triggers, new-type commissioning, result transfer, data backup, high-speed wrong-plate troubleshooting, and image-sequence cross-checks. |
| `orientation-hardware-rpc` | `0004_Hardware_Ausrichtung_EN[1]_ppt.pdf` | pp. 18–22, with visual inspection of p. 20 | Camera CPU replacement requires the new CPU MAC address to be entered in DRP system settings. Framegrabber and trigger-device status pages were checked for overlap with v356. |
| `gop-embossing-orientation` | `0003_GOP_Ausrichtung_Embossing_v5.1_EN[1].pdf` | Entire document, pp. 1–13 | End-to-end new embossed-bottle workflow: create type, physical camera setup, record geometry, capture images, define the embossing window, learn the feature, evaluate the graph, tune supported image-analysis settings, and verify correction. |
| v356 native library | `app/troubleshooting/diagnostic-library.js` | Exact commit | Source registry, safety strings, record fields, categories, ID/wording conventions, orientation records, and diagnostic flows. |
| v356 troubleshooting UI | `app/troubleshooting/index.html` | Exact commit | User-facing troubleshooting structure and terminology. No UI changes proposed. |

## Integrity notes

- SHA-256 — `11-EN-000-965.pdf`: `3fa54bde1a5cefafb38f2dfb87f54139de513c8aaecf793595e6c54784da1e9b`
- SHA-256 — `0004_Hardware_Ausrichtung_EN[1]_ppt.pdf`: `8db19b0285b9d3b790bc5210c0c7032915eb196c59a6e827f24a00aab2b2f5c3`
- SHA-256 — `0003_GOP_Ausrichtung_Embossing_v5.1_EN[1].pdf`: `76f4817b36545b4417f9a56707a4c6a47b65f9b56d77894fc622892e9b43d315`

## Source-handling boundaries

- Archived IP addresses, MAC addresses, network paths, software versions, part numbers, and example machine values are not promoted as universal settings.
- Numeric limits visible in legacy screens remain in `SME_REVIEW_QUEUE.md` unless already represented and supported in v356.
- OCR was checked against rendered source pages where it materially affected meaning.
- The documents are legacy training material. Site/OEM procedures and the machine-specific baseline remain controlling.
