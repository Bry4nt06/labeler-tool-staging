# ServoForge Troubleshooting Source Index

This index records every file supplied in `lbl backup.zip` for the Troubleshooting Library. `indexed` means text/content is used by the first diagnostic release. `visual-reference`, `binary-reference`, `link-only`, and `metadata-only` items remain cataloged but are not treated as parsed diagnostic authority.

| Source | Type | Status | Archive file |
| --- | --- | --- | --- |
| Krones Rotary Plate Control (DTS-5) | OEM training | indexed | `0001_RPC-DTS5_622_2011_EN_ppt.pdf` |
| Orientator – Commissioning of a New Bottle with Embossing | OEM training | indexed | `0003_GOP_Ausrichtung_Embossing_v5.1_EN[1].pdf` |
| Krones DRP Camera Orientation for Labellers with RPC (DTS5) | OEM training | indexed | `0004_Hardware_Ausrichtung_EN[1]_ppt.pdf` |
| KRONES DARTplus Container Orientation System | OEM training | indexed | `11-EN-000-965.pdf` |
| APL Schematic 605576 | Electrical schematic | visual-reference | `605576 (APL) Schematic.pdf` |
| Electrical Schematic 747-993 | Electrical schematic | indexed | `747-993 Electrical Schematic.pdf` |
| APL Main Contactor Reference Figure 1 | Field reference | visual-reference | `APL Main Contactor Faults/20090610014742309_0001.pdf` |
| APL Main Contactor Reference Figure 2 | Field reference | visual-reference | `APL Main Contactor Faults/20090610014742309_0002.pdf` |
| APL Main Contactor Reference Figure 3 | Field reference | visual-reference | `APL Main Contactor Faults/20090610014742309_0003.pdf` |
| APL Main Contactor Reference Figure 4 | Field reference | visual-reference | `APL Main Contactor Faults/20090610014742309_0004.pdf` |
| APL Main Contactor Reference Figure 5 | Field reference | visual-reference | `APL Main Contactor Faults/20090610014742309_0005.pdf` |
| How to Remedy APL Main Contactor Faults | Procedure | indexed | `APL Main Contactor Faults/How to Remedy APL Main Contactor Faults.doc` |
| Temporary Office Lock File – APL Main Contactor Procedure | Temporary Office file | metadata-only | `APL Main Contactor Faults/~$w to Remedy APL Main Contactor Faults.doc` |
| Allen-Bradley Kinetix 6000 Multi-Axis Servo Drive Manual Shortcut | External document shortcut | link-only | `Allen Bradley Kinetix 6000 Multi-Axis Servo Drive Manual.pdf.lnk` |
| CO85 LB1 APL Cart 1 Control Project | PLC/control project | binary-reference | `CO85_LB1_APLCart_1.ACD` |
| CO85 LB1 APL Cart 2 Control Project | PLC/control project | binary-reference | `CO85_LB1_APLCart_2.ACD` |
| CO85 LB1 APL Cart 3 Control Project | PLC/control project | binary-reference | `CO85_LB1_APLCart_3.ACD` |
| CO85 LB1 APL Cart 4 Control Project | PLC/control project | binary-reference | `CO85_LB1_APLCart_4.ACD` |
| CO85 LB1 APL Cart 5 Control Project | PLC/control project | binary-reference | `CO85_LB1_APLCart_5.ACD` |
| CO85 LB1 APL Cart 6 Control Project | PLC/control project | binary-reference | `CO85_LB1_APLCart_6.ACD` |
| CO85 LB1 Labeler Control Project | PLC/control project | binary-reference | `CO85_LB1_Labeler_1.ACD` |
| CO85 LB2 APL Cart 1 Control Project | PLC/control project | binary-reference | `CO85_LB2_APLCart_1.ACD` |
| CO85 LB2 APL Cart 2 Control Project | PLC/control project | binary-reference | `CO85_LB2_APLCart_2.ACD` |
| CO85 LB2 APL Cart 3 Control Project | PLC/control project | binary-reference | `CO85_LB2_APLCart_3.ACD` |
| CO85 LB2 APL Cart 4 Control Project | PLC/control project | binary-reference | `CO85_LB2_APLCart_4.ACD` |
| CO85 LB2 APL Cart 5 Control Project | PLC/control project | binary-reference | `CO85_LB2_APLCart_5.ACD` |
| CO85 LB2 APL Cart 6 Control Project | PLC/control project | binary-reference | `CO85_LB2_APLCart_6.ACD` |
| CO85 LB2 Labeler Control Project | PLC/control project | binary-reference | `CO85_LB2_Labeler_2.ACD` |
| Krones Schematic Tutorial R3 | OEM training | indexed | `Krones Schematic Tutorial R3.pdf` |
| Danfoss Servo Bottle Table Fault Messages | Procedure | indexed | `Labeler Danfoss Servo  How to Trouble servo bottle table fault messages.doc` |
| Danfoss Servo Bottle Plate System | OEM training | indexed | `Labeler Danfoss servo bottle plate system.doc` |
| Schematic Tutorial R3 | OEM training | indexed | `Schematic Tutorial R3.pdf` |
| Automation Studio – The Basics (TM210) | OEM training | indexed | `TM210TRE.25-ENG.pdf` |
| Automation Studio Online Communication (TM211) | OEM training | indexed | `TM211TRE.25-ENG.pdf` |
| Automation Runtime (TM213) | OEM training | indexed | `TM213TRE.25-ENG.pdf` |
| Automation Studio Diagnostics (TM223) | OEM training | indexed | `TM223TRE.25-ENG.pdf` |

## Diagnostic-authority rule

- A troubleshooting recommendation may cite only a source ID present in the diagnostic library.
- Binary `.ACD` projects are references for later PLC-aware diagnostics; the browser does not infer ladder logic from them.
- Scanned/visual-only figures are retained as provenance but do not create text-derived checks until they are explicitly reviewed and indexed.
- The Windows shortcut to the Kinetix 6000 manual is cataloged as a shortcut only; its target manual is not assumed to be present in the archive.
- The temporary `~$` Office file is retained only to prove archive completeness and is never used as diagnostic content.
