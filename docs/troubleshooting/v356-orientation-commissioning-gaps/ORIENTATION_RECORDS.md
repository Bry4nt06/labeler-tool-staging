# Track B — Normalized Orientation Records

These are implementation-ready content objects using the v356 native fields. The supplemental sections following each object keep symptom, verification, escalation, related entries, tags, and evidence explicit for the master implementation chat.

## `orientation-high-speed-wrong-plate`

```js
{
  id: "orientation-high-speed-wrong-plate",
  code: "ORIENTATION RESULT TO WRONG PLATE",
  category: "Bottle Orientation",
  aliases: ["wrong bottle plate", "wrong rotary plate", "orientation fails at speed", "high speed orientation", "result timing"],
  contextHints: ["autocol", "orientation", "camera", "rpc", "speed", "rotary plate"],
  title: "Orientation result reaches the wrong plate at higher speed",
  summary: "When orientation is acceptable at low speed but the result is assigned to the wrong rotary plate as speed increases, the DARTplus training directs the technician to verify trigger geometry, RPC table data, motor assignment and result/revolution timing evidence before changing orientation offsets.",
  probableCauses: [
    "Distance-between-rotary-plates value does not match the machine baseline",
    "RPC table-diameter value does not match the machine baseline",
    "Camera motor assignment or COM-device motor-number offset is incorrect",
    "Result-analysis or revolution-clock timing is outside the machine-approved window",
    "RPC/table-cam synchronization is incorrect",
    "Generation-specific communication-device or framegrabber configuration is incompatible"
  ],
  checks: [
    "Confirm the symptom is speed-dependent: identify whether the same type is oriented correctly at controlled low speed and sent to a different plate as speed increases.",
    "Compare the configured distance between rotary plates and RPC table diameter with the approved machine baseline; do not copy values from the training screenshots.",
    "Verify the bottle observed after the camera is associated with the same motor number shown in RPC camera diagnostics; route an assignment mismatch to the existing orientation baseline/synchronization guidance.",
    "Review the Container orientation COM result-position and revolution-position indicators using the OEM procedure. Treat red/out-of-window evidence as a timing/configuration finding, not permission to enter legacy example values.",
    "If encoder or table-cam work preceded the issue, use the existing orientation synchronization entry."
  ],
  actions: [
    "Correct only a documented mismatch against the machine-specific baseline under the approved commissioning procedure.",
    "After each approved change, repeat the same bottle/type test at controlled low speed and then at the authorized production speed.",
    "Escalate generation-specific communication-device, software, or framegrabber changes instead of applying the archived version or hardware examples."
  ],
  safety: [safety.observe, safety.servo],
  sourceRefs: [
    { sourceId: "dartplus-11-en-000-965", locator: "Basic setup and motor assignment, pp. 22–24; 18.2 Basic problems with orientation, p. 52" }
  ]
}
```

- Symptom: Orientation works at low/controlled speed but the result is sent to the wrong plate at higher speed.
- Quick checks: Confirm speed dependency; compare recipe/machine geometry with the approved baseline; verify motor assignment; review result/revolution timing indicators.
- Verification: Same type remains assigned to the correct plate at both controlled low speed and authorized production speed; no new orientation or image-sequence faults appear.
- Escalation: No approved baseline is available; timing remains outside the approved window; the GUI lacks the documented controls; or software/communication-device/framegrabber changes are indicated.
- Related entries: `autocol-orientation-baseline`, `orientation-inaccurate`, `orientation-sync-after-encoder`, `orientation-trigger-geometry-baseline`, `orientation-image-sequence`.
- Tags: `orientation`, `DARTplus`, `RPC`, `high speed`, `wrong plate`, `result timing`.
- Safety boundary: HMI observation may be performed without defeating guards. Motion tests, servo work, parameter changes, and production-speed verification require authorized qualified personnel and the approved guarded procedure.

## `orientation-trigger-geometry-baseline`

```js
{
  id: "orientation-trigger-geometry-baseline",
  code: "ORIENTATION TRIGGER GEOMETRY",
  category: "Autocol / Orientation",
  aliases: ["distance between rotary plates", "table diameter", "orientation trigger position", "result timing geometry"],
  contextHints: ["autocol", "orientation", "dart", "rpc", "trigger", "geometry"],
  title: "Verify orientation trigger geometry against the machine baseline",
  summary: "DARTplus commissioning uses the distance between rotary plates in the orientation triggering setup and the table diameter in RPC machine parameters. A mismatch can shift result timing and may only become obvious as speed increases.",
  probableCauses: [
    "Distance-between-rotary-plates setting differs from the approved machine geometry",
    "RPC table-diameter setting differs from the approved machine geometry",
    "Bottle-present or result-transfer timing no longer matches the configured geometry",
    "Geometry changed without the required recalibration or synchronization workflow",
    "Motor assignment or camera COM-device offset is incorrect"
  ],
  checks: [
    "Identify the affected bottle type and whether the issue began after recipe, camera, encoder, RPC, or mechanical work.",
    "Read the distance-between-rotary-plates value in the documented DARTplus orientation-triggering screen and compare it with the approved machine baseline.",
    "Read the table-diameter value in RPC machine parameters and compare it with the approved machine baseline.",
    "Check bottle-present evidence, orientation statistics, motor assignment and result-transfer timing before changing geometry.",
    "Determine from the OEM commissioning procedure whether the specific geometry change requires recalibration and/or synchronization."
  ],
  actions: [
    "Do not derive geometry from a legacy screenshot. Restore only a verified machine-specific value under change control.",
    "If an approved geometry correction is made, complete every required calibration/synchronization step and save/backup the result under the OEM procedure.",
    "Use the high-speed wrong-plate entry when the main symptom is correct low-speed operation followed by wrong-plate assignment at speed."
  ],
  safety: [safety.observe, safety.servo],
  sourceRefs: [
    { sourceId: "dartplus-11-en-000-965", locator: "Basic setup, p. 22; calibration conditions, pp. 25–27; result transfer, pp. 29–30; 18.2 Basic problems with orientation, p. 52" }
  ]
}
```

- Symptom: Orientation timing or plate assignment is inconsistent after recipe, geometry, camera, encoder, RPC, or mechanical work.
- Quick checks: Compare both documented geometry fields with the machine baseline; check bottle-present, statistics, motor assignment, and transfer evidence.
- Verification: Approved values are restored; any required calibration/synchronization completes; test bottles are assigned and oriented consistently.
- Escalation: Baseline values are unavailable or conflicting; the machine generation uses different screen labels; calibration acceptance cannot be confirmed; or changes would affect controller/servo behavior.
- Related entries: `orientation-high-speed-wrong-plate`, `autocol-orientation-baseline`, `orientation-inaccurate`, `orientation-sync-after-encoder`.
- Tags: `orientation`, `trigger geometry`, `rotary plates`, `table diameter`, `RPC`, `DARTplus`.
- Safety boundary: Reading HMI values is observational. Entering values, calibrating, synchronizing, forcing signals, or running guarded motion tests is qualified-personnel work.

## `orientation-camera-cpu-replacement`

```js
{
  id: "orientation-camera-cpu-replacement",
  code: "CAMERA CPU REPLACEMENT",
  category: "Autocol / Orientation",
  aliases: ["new camera CPU", "camera CPU MAC", "DRP network subsystem", "camera replacement no communication"],
  contextHints: ["autocol", "orientation", "camera", "cpu", "network", "drp"],
  title: "Restore DRP network identity after camera CPU replacement",
  summary: "The orientation hardware training states that a replacement camera CPU has a new MAC address that must be updated in the DRP system settings. The archived screen values are examples, not universal network settings.",
  probableCauses: [
    "Replacement camera CPU MAC address was not entered in DRP system settings",
    "Entered network identity does not match the installed replacement CPU",
    "Camera CPU replacement was not followed by the required machine-specific restore/verification procedure",
    "A separate camera cable, framegrabber, trigger/CAN, or 24 V fault is present"
  ],
  checks: [
    "Confirm that the fault began immediately after camera CPU replacement.",
    "Obtain the installed replacement CPU identity using the approved OEM/site method; do not use the address shown in the training screenshot.",
    "Compare the installed CPU MAC address with the DRP Network subsystems (DHCP) entry under the qualified controls procedure.",
    "If identity matches but image acquisition still fails, route to the existing faulty-image-sequence and trigger/CAN entries."
  ],
  actions: [
    "A qualified controls technician may update the DRP network-subsystem entry to the verified replacement CPU identity under change control.",
    "Complete the machine-specific restart/restore sequence, confirm camera readiness and image acquisition, and preserve the revised configuration using the approved backup procedure.",
    "Do not publish or reuse the archived IP or MAC values."
  ],
  safety: [safety.loto, safety.electrical],
  sourceRefs: [
    { sourceId: "orientation-hardware-rpc", locator: "Replacing the camera CPU, p. 20; framegrabber status context, p. 19" },
    { sourceId: "dartplus-11-en-000-965", locator: "17.3 Data back-up, pp. 49–50" }
  ]
}
```

- Symptom: Camera/orientation communication or image acquisition is absent after camera CPU replacement.
- Quick checks: Confirm replacement timing; identify the installed CPU; compare its identity with the DRP network-subsystem entry; then separate identity from cable/framegrabber/trigger faults.
- Verification: Camera/framegrabber reaches normal ready state, live/image capture works, orientation result reaches RPC, and the updated configuration is backed up.
- Escalation: CPU identity cannot be verified; network entry conflicts with the machine standard; controller access or restore fails; or hardware status indicates a separate electrical/CAN fault.
- Related entries: `orientation-image-sequence`, `orientation-trigger-can`, `autocol-orientation-baseline`.
- Tags: `orientation`, `camera CPU`, `MAC address`, `DRP`, `DHCP`, `replacement`.
- Safety boundary: CPU replacement and enclosure/cabling work require LOTO and stored-energy controls. Network/controller changes require qualified controls personnel. Energized diagnostics require electrical qualification.

## `dart-embossed-bottle-commissioning`

```js
{
  id: "dart-embossed-bottle-commissioning",
  code: "EMBOSSED BOTTLE COMMISSIONING",
  category: "Autocol / Orientation",
  aliases: ["new embossed bottle", "learn embossing", "create orientation type", "embossing setup", "DART bottle type"],
  contextHints: ["autocol", "orientation", "dart", "embossing", "camera", "commissioning"],
  title: "Commission a new embossed-bottle orientation type",
  summary: "The OEM sequence creates a new labeler/DART type from a similar production type, establishes camera and bottle geometry, captures representative images, defines and learns the embossing feature, evaluates the detection graph, verifies the correction direction, and preserves the completed setup.",
  probableCauses: [
    "New type was not created in both the labeler and DART workflow",
    "An unsuitable source type was copied",
    "Camera height or horizontal geometry was not recorded for the new bottle",
    "Container diameter at the embossing/seam location is incorrect",
    "Image buffer contains unsuitable or old images",
    "Embossing analysis window does not isolate the target feature",
    "Feature was not relearned after image-analysis or camera-setting changes",
    "Correction direction/angle or result transfer was not verified"
  ],
  checks: [
    "Confirm this is an authorized new-type commissioning task and record the source production type, new type number/name, bottle, labeler aggregate and machine baseline.",
    "Confirm the new type exists and is selected in both the labeler and DARTplus before editing its orientation setup.",
    "With the machine secured under the approved setup procedure, position the bottle/embossing at the camera and establish the documented physical camera relationship; record the final horizontal and height values in the type notes.",
    "Enter the measured container diameter at the embossing/seam location using the OEM procedure.",
    "Clear the camera image buffer, capture multiple representative bottles after valid bottle-present triggers, download/review the images, and define an analysis section that contains the target feature.",
    "Learn the embossing and evaluate the result graph for a distinct repeatable feature. If approved settings are changed, capture/relearn as required before judging the result.",
    "Check the bottle position relative to the first labeling aggregate and verify the correction direction/angle through the approved guarded test."
  ],
  actions: [
    "Start from a verified similar production type and document every type-specific change; do not copy the example values from the training deck.",
    "Tune only the OEM-supported settings needed to isolate a repeatable feature, one controlled change at a time, and relearn/retest after changes.",
    "Complete required calibration or synchronization when commissioning conditions or geometry changes call for it.",
    "Verify orientation and result transfer with representative bottles at controlled speed, then at authorized production speed.",
    "Save the completed type and perform the approved DARTplus/zenon backup after successful verification."
  ],
  safety: [safety.loto, safety.servo],
  sourceRefs: [
    { sourceId: "gop-embossing-orientation", locator: "Complete commissioning sequence, pp. 1–13" },
    { sourceId: "dartplus-11-en-000-965", locator: "Basic setup and calibration/new type, pp. 22–30; 17.3 Data back-up, pp. 49–50" }
  ]
}
```

- Symptom/use case: A new embossed bottle needs a validated DARTplus orientation type; this is planned commissioning, not a fault reset.
- Quick checks: Authorization, correct source type, matching type selection, physical camera geometry, recorded type notes, measured diameter, valid image set, isolated target feature.
- Verification: Repeatable feature graph; correct correction direction; correct motor/plate result; stable guarded tests at controlled and authorized production speeds; completed backup confirmation.
- Escalation: No verified similar type; target cannot be isolated repeatably; machine-generation screens differ; calibration criteria are unclear; correction behavior conflicts with the OEM sequence; or production-speed results are unstable.
- Related entries: `autocol-orientation-baseline`, `orientation-inaccurate`, `orientation-trigger-geometry-baseline`, `orientation-high-speed-wrong-plate`, `orientation-image-sequence`, `orientation-sync-after-encoder`.
- Tags: `DARTplus`, `embossing`, `new type`, `commissioning`, `camera`, `Autocol`, `orientation`.
- Safety boundary: Qualified commissioning/maintenance procedure only. Physical positioning, camera adjustment, motion tests, calibration, synchronization, and controller changes must follow site guarding, LOTO, stored-energy, and OEM setup controls.
