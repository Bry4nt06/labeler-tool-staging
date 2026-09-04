"use strict";

(function installTopModulStationProcessTrace(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationProcessTraceExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getStationFaultTemplate || !base?.getTopModulCircuitSource) {
      throw new Error("TopModul Station diagnostic layers are required before process tracing.");
    }

    const HARDWARE_SOURCE = base.getTopModulCircuitSource("apl-cart-k605163");
    if (!HARDWARE_SOURCE) throw new Error("K605163 APL Cart circuit source is required.");

    const PLC_SOURCE = Object.freeze({
      id: "co85-lb1-apl-cart-1-l5k",
      file: "CO85_LB1_APLCart_1.L5K",
      controller: "CO85_LB1_APLCart_1",
      evidenceClass: "readable-cart-plc-export",
      sourceDiscipline: "Process equations, timers, counters and producer conditions are taken from the supplied readable Cart 1 L5K. One shared Station method is used only where the six-station alarm architecture has already been validated as common."
    });

    const freezeRows = (rows) => Object.freeze(rows.map((row) => Object.freeze({ ...row })));
    const process = (status, confidence, routine, producerSignals, calculationSteps, hardwareRows, drawingLocations, summary, safetyBoundary, scopeNote) => Object.freeze({
      status,
      confidence,
      routine,
      producerSignals: Object.freeze(producerSignals),
      calculationSteps: freezeRows(calculationSteps),
      hardwareRows: freezeRows(hardwareRows),
      drawingLocations: freezeRows(drawingLocations),
      source: PLC_SOURCE,
      hardwareSource: hardwareRows.length ? HARDWARE_SOURCE : null,
      summary,
      safetyBoundary,
      scopeNote
    });

    const PROCESS = Object.freeze({
      17: process(
        "direct-motion-instruction-error-state-bound",
        "exact-cart-plc-producer",
        "MainDrive / fault handling",
        [
          "MainDrive.MTags.MSO[0].ER",
          "MainDrive.MTags.MSO[0].EN",
          "MainDrive.SData.Status.ReadyForFeedbackON",
          "Faults[1].1"
        ],
        [
          { label: "Command state", value: "MSO[0] is enabled (EN=1) while the Motion Servo On instruction reports ER=1" },
          { label: "Prerequisite", value: "MainDrive.SData.Status.ReadyForFeedbackON must already be true" },
          { label: "Fault action", value: "Fault 017 latches and machine Jog/On enables are removed until reset" }
        ],
        [
          { device: "AFD101 / MainDriveAxis", description: "Station Kinetix servo axis receiving the Motion Servo On command", area: "+KA", cable: "SERCOS W111/W112", terminals: "MainDriveAxis via 1756-M08SE Slot 12, SERCOS Node 1" }
        ],
        [{ pdfPage: 47, sheet: "11/72", section: "AFD101 SERCOS interface / station servo drive" }],
        "Fault 017 is not a physical 'feedback wire open' alarm. The Cart PLC creates it when the Motion Servo On instruction itself is enabled and in error while the station logic says the axis is ready for feedback-on. ServoForge therefore treats direct servo/module faults 032-054 and Motion Group Fault 016 as higher-specificity evidence before replacing drive hardware.",
        "Do not force MSO status bits, ReadyForFeedbackON or axis state. Use normal motion diagnostics. Prevent unexpected servo motion before drive, motor, SERCOS or feedback-cable work.",
        "Shared Station process method. This alarm describes a failed motion-command state; the underlying cause can still be a direct Kinetix/module condition surfaced by another fault."
      ),
      18: process(
        "direct-calculated-geometry-limit-bound",
        "exact-cart-plc-formula",
        "LabelingData calculations",
        [
          "LabelingData.Sync_Distance",
          "LabelingData.LabelLength",
          "LabelingData.ACC_Distance",
          "LabelingData.SyncVelocity",
          "LabelingData.MaxAcceleration",
          "Faults[1].2"
        ],
        [
          { label: "Configured label length", value: "LabelingData.LabelLength = ParLS_Actual.Par1[12] / 100" },
          { label: "Max acceleration", value: "LabelingData.MaxAcceleration = ParLS_Actual.Par1[14] × 1000" },
          { label: "Sync velocity", value: "BaseMachinePitchOutside × MaxSpeed / 3600 × SyncSpeedFactor" },
          { label: "Acceleration time", value: "ACC_Time = SyncVelocity / MaxAcceleration" },
          { label: "Acceleration distance", value: "ACC_Distance = SyncVelocity × ACC_Time / 2" },
          { label: "Fault calculation", value: "Sync_Distance = LabelLength - ACC_Distance - ACC_Distance; Fault 018 is true when Sync_Distance < 0" }
        ],
        [],
        [],
        "Fault 018 is a calculated motion-profile feasibility problem, not an electrical device failure. In this PLC revision the available label travel is shorter than the combined acceleration and deceleration distance required by the current speed, pitch/synchronization factor and acceleration settings. Diagnose the inputs to the equation before looking for hardware.",
        "Parameter changes can alter labeler motion. Verify values against the approved setup/specification and test changes under normal commissioning controls; do not use unsafe speed/acceleration changes merely to suppress the alarm.",
        "No electrical device is claimed for Fault 018 because its producer is the PLC equation itself."
      ),
      19: process(
        "direct-calculated-cycle-utilization-limit-bound",
        "exact-cart-plc-formula",
        "LabelingData calculations",
        [
          "LabelingData.OverallMovementPercent",
          "LabelingData.Move_Time",
          "LabelingData.TimeOneCycle",
          "LabelingData.ACC_Time",
          "LabelingData.Sync_Time",
          "LabelingData.MaxSpeed",
          "Faults[1].3"
        ],
        [
          { label: "Move time", value: "Move_Time = ACC_Time + ACC_Time + Sync_Time" },
          { label: "Available cycle time", value: "TimeOneCycle = 1 / (MaxSpeed / 3600)" },
          { label: "Utilization", value: "OverallMovementPercent = 100 × Move_Time / TimeOneCycle" },
          { label: "Fault threshold", value: "Fault 019 is true when OverallMovementPercent > 125" }
        ],
        [],
        [],
        "Fault 019 means the calculated label-motion profile requires more than 125% of the available base-machine cycle time in this Cart revision. It is therefore a setup/profile constraint driven by speed and the calculated acceleration/synchronization timing, not evidence that a motor or sensor has failed.",
        "Do not increase machine/axis limits outside the approved equipment specification to clear this calculation fault. Correct the underlying setup values and revalidate the motion profile.",
        "Fault 018 and Fault 019 are related calculations: a negative synchronization distance and excessive cycle utilization can share the same upstream speed/label-length/acceleration inputs, but they are different thresholds."
      ),
      22: process(
        "registration-derived-label-length-supervision-bound",
        "exact-cart-plc-counter-and-tolerance",
        "MainDrive label-length measurement",
        [
          "PulseCheckAndCalcPrintMark",
          "StoreMAR_PC",
          "StoreMAR_RegPosition",
          "RegistrationPosition_1",
          "LabelingData.LabelLengthActual",
          "LabelLengthDifActual",
          "MeasureError",
          "CountLabelLengthBad",
          "ParLS_Actual.Par1[22]",
          "Faults[1].6"
        ],
        [
          { label: "Measurement source", value: "Two registration positions are used to calculate LabelLengthActual" },
          { label: "Difference", value: "LabelLengthDifActual = LabelLengthActual - configured LabelLength" },
          { label: "Tolerance", value: "PLC builds ±20% limits from configured LabelLength" },
          { label: "Bad-label counter", value: "Each MeasureError increments CountLabelLengthBad; a good sequence clears the bad counter" },
          { label: "Fault threshold", value: "Fault 022 latches when CountLabelLengthBad >= ParLS_Actual.Par1[22]; an alternate auto-change threshold uses ParLS_Actual.Par1[19]" }
        ],
        [
          { device: "P141 / AFD101 REG1", description: "Label-position/reference registration sensor path used by the station servo", area: "+ETS / +KA", cable: "2001-W141", terminals: "P141 -> CN141/TB52 -> AFD101 REG1, REG_COM and registration 24 V circuit" }
        ],
        [{ pdfPage: 51, sheet: "59/72", section: "P141 label-position sensor / AFD101 registration input" }],
        "Fault 022 is a repeated label-length measurement fault, not a one-scan photoeye alarm. The PLC derives actual label length from registration positions, checks the difference against ±20% of the configured label length, counts consecutive/bounded measurement errors and only then latches the alarm when the configured bad-count threshold is reached. ServoForge therefore starts with actual label stock/setup and the P141 registration path before treating the servo drive as failed.",
        "Observe registration behavior safely. Isolate motion before sensor alignment or wiring work. Do not force registration bits or widen tolerances simply to suppress a recurring measurement problem.",
        "P141 hardware is shared with the existing Fault 021 reference-run method; v334 reuses that physical authority rather than creating another station-specific sensor model."
      ),
      28: process(
        "rewind-arm-dynamics-web-jam-supervision-bound",
        "exact-cart-plc-rewind-dynamics",
        "RewindUnit",
        [
          "Rewinder.enable",
          "Rewinder.dx",
          "Rewinder.yi",
          "LabelingData.PulseStartNextCam",
          "RewinderTimeout",
          "StorePulseOneCycWithWebJam",
          "StorePulseTwoCycWithWebJam",
          "FixedArm",
          "E5701_P602_RewinderUnitActualValue",
          "Local:9:I.In[0].Data",
          "Faults[1].12"
        ],
        [
          { label: "Web-jam branch", value: "With rewind enabled, dx < -2000 and yi >= 0, the PLC supervises successive label-cycle pulses after RewinderTimeout > 100" },
          { label: "Cycle confirmation", value: "The jam fault is latched after the supervision persists through the stored two-cycle sequence" },
          { label: "Fixed-arm branch", value: "A separate FixedArm timer also latches the same Fault 028 if the rewinder arm fails to move while commanded motion is present" },
          { label: "Primary feedback", value: "P602 analog arm actual value -> Local:9:I.In[0].Data -> computed Rewinder.x / rewind control values" }
        ],
        [
          { device: "P602", description: "Rewind-unit arm actual-value analog sensor", area: "+AU", cable: "5701-W602", terminals: "P602 -> TB52 -> I/O051 IN-0; PLC alias E5701_P602_RewinderUnitActualValue = Local:9:I.In[0].Data" },
          { device: "MTR601", description: "Rewind-unit motor/drive controlled by the same rewind loop", area: "+AU", cable: "5701-W601", terminals: "Rewind ready/release/speed path; exact shared Station drive circuit established in v330" }
        ],
        [{ pdfPage: 52, sheet: "60/72", section: "P602 rewind arm actual value, MTR601 rewind unit and PE603" }],
        "Fault 028 is generated by rewind-control dynamics, not by a dedicated 'web jam photoeye.' The Cart PLC can reach the same alarm through persistent web-jam control error or a fixed rewinder arm. P602 is therefore the most important physical feedback to compare with actual arm motion, while MTR601 command/ready behavior is the companion motion evidence.",
        "Stop and isolate rewind motion before checking arm freedom, sensor linkage, web path or wiring. Keep clear of stored web tension and rotating rewind components. Energized analog measurements are for qualified personnel.",
        "A mechanical bind, web-path jam, P602 feedback problem or rewind-drive response problem can produce similar control symptoms; the PLC branches are shown so the technician can distinguish them."
      ),
      29: process(
        "rewind-arm-web-break-time-supervision-bound",
        "exact-cart-plc-rewind-timer",
        "RewindUnit",
        [
          "Rewinder.enable",
          "ComputedRewindUnitActualValue",
          "WebBreakTime",
          "PV_General.RunWithoutLabels",
          "E5701_P602_RewinderUnitActualValue",
          "Local:9:I.In[0].Data",
          "Faults[1].13"
        ],
        [
          { label: "Enable condition", value: "Rewinder.enable must be true" },
          { label: "Arm-value threshold", value: "ComputedRewindUnitActualValue > 29000 starts/increments WebBreakTime" },
          { label: "Time threshold", value: "Fault 029 latches when WebBreakTime > 1000 and RunWithoutLabels is false" },
          { label: "Reset condition", value: "WebBreakTime clears when rewind is not enabled or computed arm value falls below 29000" }
        ],
        [
          { device: "P602", description: "Rewind-unit arm actual-value analog sensor", area: "+AU", cable: "5701-W602", terminals: "P602 -> TB52 -> I/O051 IN-0; Local:9:I.In[0].Data" },
          { device: "MTR601", description: "Rewind-unit motor/drive", area: "+AU", cable: "5701-W601", terminals: "Rewind motor command/ready path from shared Station drive circuit" }
        ],
        [{ pdfPage: 52, sheet: "60/72", section: "P602 rewind arm actual value and MTR601 rewind unit" }],
        "Fault 029 is the PLC's 'web break after head' supervision. The code expects the rewind arm feedback to recover while the rewinder is enabled; if the computed P602-derived arm value remains above 29000 for more than 1000 counts, the alarm latches. That makes web continuity/tension, arm movement, P602 feedback and rewind response more relevant than unrelated label sensors.",
        "Treat the web and rewind arm as stored mechanical energy. Stop and isolate the rewind system before hands-on web, arm, sensor or drive inspection.",
        "Fault 028 and 029 share P602/MTR601 hardware but use different PLC behavior: 028 diagnoses jam/fixed-arm dynamics; 029 diagnoses the sustained high arm-value condition interpreted as web break after head."
      )
    });

    function processForEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope !== "Station") return null;
      return PROCESS[Number(entry.stationTemplateOffset)] || null;
    }

    function enrich(entry) {
      if (!entry?.plcFault) return entry;
      const trace = processForEntry(entry);
      return trace ? Object.freeze({ ...entry, processTrace: trace }) : entry;
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const getStationFaultTemplate = (offset) => enrich(base.getStationFaultTemplate(offset));
    const getStationFaultVariant = (offset, station) => enrich(base.getStationFaultVariant(offset, station));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, limit).map(enrich);

    function getTopModulProcessTrace(value) {
      const entry = typeof value === "object" && value ? enrich(value) : getTopModulFault(value) || getEntry(value);
      return entry?.processTrace || null;
    }

    function getTopModulFaultDrillDown(value, limit = 10) {
      const original = base.getTopModulFaultDrillDown(value, limit);
      if (!original) return null;
      const entry = enrich(original.entry);
      return Object.freeze({
        ...original,
        entry,
        related: (original.related || []).map(enrich),
        firstFaultCandidates: (original.firstFaultCandidates || []).map(enrich),
        processTrace: entry.processTrace || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      for (const offset of [17, 18, 19, 22, 28, 29]) {
        if (!getStationFaultTemplate(offset)?.processTrace) errors.push(`Station process offset ${offset} lost its process trace.`);
      }
      const f18 = getStationFaultTemplate(18)?.processTrace;
      if (!f18?.calculationSteps?.some((row) => /Sync_Distance = LabelLength/.test(row.value))) errors.push("Fault 018 lost exact Sync_Distance equation.");
      const f19 = getStationFaultTemplate(19)?.processTrace;
      if (!f19?.calculationSteps?.some((row) => /OverallMovementPercent = 100/.test(row.value))) errors.push("Fault 019 lost cycle-utilization equation.");
      const f22 = getStationFaultTemplate(22)?.processTrace;
      if (!f22?.calculationSteps?.some((row) => /±20%/.test(row.value))) errors.push("Fault 022 lost ±20% label-length tolerance evidence.");
      if (!f22?.hardwareRows?.some((row) => row.device.includes("P141"))) errors.push("Fault 022 lost P141 registration hardware context.");
      const f28 = getStationFaultTemplate(28)?.processTrace;
      const f29 = getStationFaultTemplate(29)?.processTrace;
      if (!f28?.hardwareRows?.some((row) => row.device === "P602")) errors.push("Fault 028 lost P602 rewind-arm evidence.");
      if (!f29?.calculationSteps?.some((row) => /29000/.test(row.value))) errors.push("Fault 029 lost rewind-arm threshold evidence.");
      if (getStationFaultTemplate(31)?.processTrace) errors.push("Fault 031 must remain without a promoted process producer in this Cart revision.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-process-trace-v1`,
      getEntry,
      getTopModulFault,
      getStationFaultTemplate,
      getStationFaultVariant,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      getTopModulProcessTrace,
      topModulStationProcessTraceOffsets: Object.freeze([17, 18, 19, 22, 28, 29]),
      validate
    });
  };
});
