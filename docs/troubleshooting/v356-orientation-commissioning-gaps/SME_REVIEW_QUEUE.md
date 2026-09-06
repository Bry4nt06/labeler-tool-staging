# Track B — SME Review Queue

No item below should be published as a universal setting or procedure until resolved against the relevant machine generation and current OEM/site documentation.

| Priority | Topic | Source evidence | Why review is required | Required disposition |
|---|---|---|---|---|
| High | Legacy result/revolution timing limits | `11-EN-000-965.pdf`, p. 23 | The training shows numeric red/green limits, but they may be software- and generation-specific. | Confirm supported limits per machine/software generation or leave values omitted. |
| High | Missing GUI point and legacy upgrade remedy | `11-EN-000-965.pdf`, p. 52 | The source references a legacy communication-device version, software level, part number and manual programming for newer double framegrabbers. Applying these generically could create incompatibility. | Replace with current OEM-approved compatibility route by hardware/software generation. |
| High | Camera CPU network procedure | `0004_Hardware_Ausrichtung_EN[1]_ppt.pdf`, p. 20 | The requirement to update the MAC address is clear, but the archived IP/MAC screenshot and restart/restore details are machine-specific. | Confirm the current path, permissions, restart sequence, and backup/rollback procedure. Never publish the screenshot addresses as defaults. |
| High | Commissioning authority and guarded movement | `0003_GOP_Ausrichtung_Embossing_v5.1_EN[1].pdf`, pp. 3–13 | The source expects physical bottle/camera setup and repeated machine movement but does not define the site guarding method. | Attach the current site/OEM safe setup and guarded test procedure. |
| Medium | Exposure, amplification, color depth, filters and ToolType choices | Embossing deck pp. 4, 11–12 | The deck provides examples/ranges, but values depend on bottle, optics, lighting, camera and software generation. | Approve type-specific tuning guidance or retain qualitative wording only. |
| Medium | Physical 80 mm relationship | Embossing deck p. 3; DARTplus pp. 27, 51 | v356 already uses 80 mm, but the source phrases the target relative to the characteristic/protective panel and the deck wording is terse. | Confirm the exact measurement endpoints and applicable hardware generations. |
| Medium | Calibration acceptance values | `11-EN-000-965.pdf`, pp. 25–27 | Legacy numeric acceptance criteria are readable but may not apply universally. | Confirm by DARTplus version/machine generation before inclusion. |
| Medium | Result-transfer timing and orientation deviation | `11-EN-000-965.pdf`, pp. 29–30 | Legacy timing/deviation values may depend on RPC/DART configuration. | Confirm applicable limits or keep verification qualitative. |
| Medium | Embossing deck internal step references | Embossing deck pp. 11–12 | “Learn again” references do not consistently match the visible step numbering, likely from slide revisions/OCR. | Correct the references against the controlled OEM version; the normalized guide avoids step numbers. |
| Medium | Backup destination and workflow | `11-EN-000-965.pdf`, pp. 49–50 | Legacy paths and zenon integration differ by installation. | Link the current site backup/restore procedure; retain only the requirement to wait for success and complete the approved backup. |
| Low | Exact screen/menu labels across versions | All three sources | Labels may differ between DARTplus/DRP/zenon releases. | Add version aliases only after screenshots are verified on supported machines. |

## Explicitly withheld content

- Archived IP addresses and MAC addresses.
- Legacy network/storage paths as universal instructions.
- Unverified software versions and part numbers.
- Legacy numeric timing, calibration, exposure, filter, and result thresholds.
- Any instruction to force signals, bypass interlocks, defeat guards, or perform unqualified energized work.
