# Track A source inventory — RPC / Danfoss gaps

## Scope

- Repository: `Bry4nt06/labeler-tool-staging`
- Working branch: `codex/v356-rpc-danfoss-gaps`
- Required baseline: `dc08d4a49b5e0e9650e040e0b1930cbbf9a16435` (v356)
- Status: research and app-shaped handoff only; no runtime files changed

## Primary sources reviewed

| Source | Locator | Material retained for the handoff |
|---|---|---|
| `Labeler Danfoss servo bottle plate system.doc` | “Checking the System for Proper Operation” / commissioning procedure | Touchscreen code 600 meaning, Power PC/master readiness, Ethernet link indication, connection delay, CompactFlash network-configuration check, CAN-IO LED checks, and scope-based missing-motor checks. |
| `0001_RPC-DTS5_622_2011_EN_ppt.pdf` | pp. 12–14 | AC/DC converter role, connector overview, and source-machine CAN settings. Settings are reference evidence only, not generic adjustment instructions. |
| Same RPC PDF | pp. 21–30 | Required tools, safe shutdown and ten-minute wait, motor removal/reinstallation sequence, connector-tool restriction, and post-replacement motor addressing. |
| Same RPC PDF | pp. 32–35 | Servomotor firmware note, 300 V supply diagnostics, monitoring-board fuse/line status, detailed error message, and servo trace. |
| Same RPC PDF | pp. 37–38 | Bottle-plate zeroing context and moment-of-inertia parameter context. These require SME confirmation before technician-facing instructions. |

## Existing v356 app material reviewed

- `app/troubleshooting/diagnostic-library.js`
- `app/troubleshooting/topmodul-servo-table-internal-status.js`
- `app/troubleshooting/index.html`

## Evidence-handling limits

- Do not publish archived IP addresses, credentials, or machine-specific network values.
- Do not present node address `0x78` or `500 kbit/s` as a universal adjustment; the RPC deck documents a particular machine standard.
- Do not invent torque, grease, thread-sealant, or firmware values absent from an approved current procedure.
- Treat 2011 training slides as historical technical evidence pending confirmation against the installed RPC generation.
- The legacy Word document was text-extracted; wording should be checked against the original before any verbatim UI copy.

