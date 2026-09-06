"use strict";

(function installServoForgeUniversalMethods(root, factory) {
  const extendLibrary = factory(root?.ServoForgeUniversalTroubleshooting);
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) {
    root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createUniversalMethodsExtension(universal) {
  return function extendLibrary(base) {
    if (!base?.searchEntries || !base?.getEntry || !Array.isArray(base.entries) || !universal?.families) {
      throw new Error("ServoForge troubleshooting library and universal core are required before universal methods v370.");
    }

    const OBSERVE = "Use normal HMI/controller diagnostics and safe observation first. Do not force inputs/outputs or defeat guards, interlocks, or safety devices.";
    const LOTO = "Follow site lockout/tagout and stored-energy procedures before hands-on mechanical inspection, connector work, or opening electrical enclosures.";
    const ELECTRICAL = "Energized electrical or signal measurements are for personnel qualified under the site's approved electrical safe-work program and the applicable machine procedure.";
    const MOTION = "Prevent unexpected machine/servo motion before hands-on work. Verify the affected axis or mechanism cannot re-enable unexpectedly.";

    const methods = Object.freeze([
      {
        id: "universal-safety-interlock", universalFamilyId: "safety-interlock", code: "UNIVERSAL — SAFETY / INTERLOCK", category: "Universal / Safety & Permissives",
        aliases: ["safety chain open", "guard open", "e stop active", "interlock not made", "permissive missing", "machine will not reset"],
        title: "Safety / interlock condition is not satisfied",
        summary: "Use this method when a machine cannot start, reset, enable, or remain enabled because a safety, guard, E-stop, operating-mode, reset, or permissive condition is not satisfied. Device names and PLC tags vary by site; isolate the missing condition before tracing machine-specific hardware.",
        probableCauses: ["A physical safety device or guard condition is genuinely open.", "A reset/mode prerequisite has not been satisfied.", "A field device and its controller indication disagree because of a device, wiring, I/O, or communication problem.", "A downstream summary alarm is reporting an upstream safety condition."],
        checks: ["Identify the earliest safety/interlock indication rather than troubleshooting a later summary alarm first.", "From a safe position, compare the physical state of the named guard/E-stop/device with the HMI/controller indication.", "Determine whether one device/path is affected or several safety conditions changed together.", "If an Analyzer context is attached, use its actual tag/rung evidence only to locate this machine's implementation; do not assume those names apply elsewhere.", "If physical state and controller state disagree, stop and trace the applicable device/input path under the site's approved safety/electrical procedure."],
        actions: ["Restore the actual safe condition and use the normal reset/start sequence.", "Repair a proven device, wiring, I/O, or communication fault rather than bypassing the safety function."],
        safety: [OBSERVE, LOTO, ELECTRICAL], sourceRefs: []
      },
      {
        id: "universal-power-electrical", universalFamilyId: "power-electrical", code: "UNIVERSAL — POWER / ELECTRICAL", category: "Universal / Power & Electrical",
        aliases: ["no control power", "contactor will not pull in", "breaker tripped", "fuse open", "power loss", "phase loss", "control voltage missing"],
        title: "Power / electrical supply path is not in the expected state",
        summary: "Use this method for missing control power, contactor feedback, protection-device trips, phase/voltage faults, or a load that is not receiving its expected electrical supply. Exact component designations and voltages are machine-specific.",
        probableCauses: ["An upstream supply or control-voltage prerequisite is absent.", "A breaker/fuse/protection device opened because of a downstream condition.", "A contactor/relay command and feedback state do not agree.", "A connector, terminal, wiring, module, or load path is open or faulted."],
        checks: ["Identify whether the symptom affects one load, one subsystem, or multiple unrelated loads.", "Review upstream faults and protection indications before resetting or replacing components.", "Compare command vs feedback in normal diagnostics where available.", "Use machine-specific schematics only after the affected supply/load path is narrowed.", "Do not infer a universal voltage, terminal, fuse size, or reset method from another machine's source package."],
        actions: ["Correct the proven upstream supply, protection, control, connection, or load fault.", "If a protection device trips again, stop repeated resets and localize the downstream cause."],
        safety: [OBSERVE, LOTO, ELECTRICAL], sourceRefs: []
      },
      {
        id: "universal-communication", universalFamilyId: "communication", code: "UNIVERSAL — COMMUNICATION", category: "Universal / Communication",
        aliases: ["communication fault", "ethernet fault", "can fault", "node offline", "io communication", "controller communication", "network loss"],
        title: "Communication / controller path is unavailable or unhealthy",
        summary: "Use this method when a controller, I/O rack, fieldbus node, produced/consumed connection, message path, or device communication is unavailable. Network names, addresses, module slots and tags remain installation-specific.",
        probableCauses: ["One device/node has lost power, link, configuration, or communication.", "A shared switch, network segment, controller/module, or fieldbus path affects multiple devices.", "A message/produced-consumed relationship is configured differently from the expected project.", "A communication alarm is secondary to an upstream power/controller condition."],
        checks: ["Determine the scope: one device, one network segment, one controller, or multiple subsystems.", "Check normal controller/module/device diagnostics for link and connection state before touching hardware.", "Compare which faults appeared first when several devices disappeared together.", "If Analyzer context is attached, use its source-visible communication relationships to locate this machine's path, not as universal addressing.", "Under the approved stopped condition, inspect only the localized cable/connector/module path."],
        actions: ["Restore the proven power, link, module, configuration, or communication-path condition.", "Verify dependent devices return and remain stable before clearing downstream summary faults."],
        safety: [OBSERVE, LOTO, ELECTRICAL], sourceRefs: []
      },
      {
        id: "universal-encoder-feedback", universalFamilyId: "encoder-feedback", code: "UNIVERSAL — ENCODER / FEEDBACK", category: "Universal / Encoder & Feedback",
        aliases: ["encoder feedback missing", "encoder frozen", "encoder intermittent", "feedback noise", "position feedback missing", "pulse feedback"],
        title: "Expected encoder / feedback signal is missing, frozen, noisy, or implausible",
        summary: "Use this method for encoder, pulse, count, speed, or position-feedback problems regardless of the site's tag names. First separate a true feedback-path problem from a machine that is simply not moving when feedback is expected.",
        probableCauses: ["The machine/axis is not actually moving, making no feedback secondary.", "The encoder or mechanical coupling is not turning with the mechanism.", "Encoder/feedback power, cabling, connector, shielding, input, or counting path is interrupted or intermittent.", "Controller/axis logic is interpreting the feedback as invalid even though a field signal is present."],
        checks: ["Establish whether the mechanism is physically moving when the fault occurs.", "If it is moving, observe whether feedback is zero/frozen, intermittent/noisy, or plausible but offset.", "Determine whether the problem follows speed, vibration, direction, temperature, or a repeatable machine position.", "If Analyzer context is attached, use its actual feedback tag/rung as this controller's evidence only.", "Under LOTO, inspect the localized encoder drive/coupling and cable/connector path; qualified personnel can then trace signal/power through the machine-specific drawing if needed."],
        actions: ["Correct the proven no-motion, mechanical coupling, power/signal, connector, input/counting, or controller-path condition.", "Verify stable feedback through a normal guarded run before declaring the issue resolved."],
        safety: [OBSERVE, LOTO, ELECTRICAL, MOTION], sourceRefs: []
      },
      {
        id: "universal-timing-synchronization", universalFamilyId: "timing-synchronization", code: "UNIVERSAL — TIMING / SYNCHRONIZATION", category: "Universal / Timing & Synchronization",
        aliases: ["not synchronized", "sync lost", "timing fault", "fine clock", "reference lost", "registration timing"],
        title: "Timing / synchronization relationship is not maintained",
        summary: "Use this method when a machine phase, reference, fine-clock, registration, cam, or synchronization relationship is incorrect. Do not change offsets or timing parameters until feedback, reference, motion and mechanical integrity are proven.",
        probableCauses: ["A reference/encoder feedback source is missing or unstable.", "A mechanical relationship changed after service, slip, coupling work, or component replacement.", "A synchronization/reference sequence was not completed or retained.", "A controller/motion relationship is different from the intended machine configuration."],
        checks: ["Identify what must be synchronized to what: main machine, station, axis, plate/table, trigger, or inspection/coder reference.", "Check for earlier encoder, servo, communication, or reference faults.", "Verify physical/mechanical relationships before adjusting software offsets.", "Use attached Analyzer evidence only to locate this controller's actual synchronization logic and tags.", "Compare machine-specific commissioned baseline only when the machine/revision applicability is verified."],
        actions: ["Repair the underlying feedback/reference/mechanical/communication condition first.", "Perform only the approved machine-specific synchronization/reference procedure after prerequisites are proven."],
        safety: [OBSERVE, LOTO, MOTION], sourceRefs: []
      },
      {
        id: "universal-servo-motion", universalFamilyId: "servo-motion", code: "UNIVERSAL — SERVO / MOTION", category: "Universal / Servo & Motion",
        aliases: ["servo fault", "axis fault", "drive fault", "motion fault", "position error", "commutation fault", "sercos"],
        title: "Servo / motion-control path is not healthy",
        summary: "Use this method for a servo axis, drive, motion group, position, commutation, feedback, or commanded-motion problem. Drive/axis diagnostic evidence should lead the isolation; do not hide a recurring motion fault with parameter changes.",
        probableCauses: ["Drive/axis power or enable prerequisites are missing.", "The drive reports a hardware, current, voltage, thermal, feedback, communication, or motion error.", "The axis cannot follow commanded motion because of mechanical load/binding or feedback problems.", "Synchronization/reference prerequisites are not satisfied."],
        checks: ["Capture the exact drive/axis diagnostic before resetting when possible.", "Determine whether one axis or multiple axes are affected.", "Separate power/enable, drive-reported fault, feedback, mechanical load, communication, and synchronization causes.", "Use Analyzer source evidence only as the uploaded controller's implementation map.", "Do not copy drive parameters, offsets, or motor data from another site or machine revision."],
        actions: ["Correct the proven power, drive, feedback, communication, mechanical, or synchronization condition.", "Verify the axis can enable, reference/synchronize, and complete normal motion without recurrence."],
        safety: [OBSERVE, LOTO, ELECTRICAL, MOTION], sourceRefs: []
      },
      {
        id: "universal-label-supply-web", universalFamilyId: "label-supply-web", code: "UNIVERSAL — LABEL SUPPLY / WEB", category: "Universal / Label Supply & Web",
        aliases: ["no labels", "end of reel", "web break", "web jam", "rewind fault", "label feed fault", "autochange fault", "low labels"],
        title: "Label supply / web handling is outside expected condition",
        summary: "Use this method for reel supply, label-present/end-of-reel, feed, rewind, loop-buffer, web-break/jam, label-length, or autochange problems. Sensor names and PLC chronology differ by machine; preserve the actual event order.",
        probableCauses: ["The reel/web is physically empty, broken, jammed, misrouted, or not tensioning/tracking correctly.", "A label/end-of-reel/web sensor does not match the physical condition.", "Feed/rewind drive or loop-buffer motion is not behaving as expected.", "Autochange/startup logic is withholding or substituting a later summary alarm."],
        checks: ["Record the first label-supply/web event before resets or manual intervention.", "From a safe stopped state, inspect reel, web path, tension/tracking, rewind and sensor targets.", "Compare physical condition with normal sensor/drive diagnostics.", "When multiple alarms occur, distinguish the original supply/web event from downstream labeler/station summary faults.", "If Analyzer context is attached, use its actual tags and chronology only for that uploaded controller."],
        actions: ["Correct the proven material-path, sensor, feed/rewind, or autochange prerequisite.", "Verify normal tracking and supply through several cycles/changeovers as applicable."],
        safety: [OBSERVE, LOTO, MOTION], sourceRefs: []
      },
      {
        id: "universal-container-flow", universalFamilyId: "container-flow", code: "UNIVERSAL — CONTAINER FLOW", category: "Universal / Container Flow",
        aliases: ["bottles down", "container jam", "infeed gap", "discharge jam", "backup", "container spacing", "bottle transfer"],
        title: "Container flow / handling is not as expected",
        summary: "Use this method when bottles/containers are missing, down, backed up, spaced incorrectly, jammed, or not transferring correctly. Separate physical flow/handling from sensing and downstream summary alarms.",
        probableCauses: ["A mechanical guide, transfer, starwheel/worm/conveyor, clutch, or handling condition is disturbing flow.", "A sensor sees an actual gap/jam/backup or disagrees with the physical condition.", "Upstream/downstream equipment state is creating the flow symptom.", "A speed/timing relationship is unsuitable because another subsystem is not ready or synchronized."],
        checks: ["Observe where the first container loses expected position/spacing/flow.", "Determine whether the condition is continuous, product-specific, speed-dependent, or intermittent.", "Compare physical bottle flow with the relevant sensor indications.", "Check upstream/downstream readiness before treating the local labeler alarm as root cause.", "Use uploaded Analyzer tags only to locate this machine's sensing/control implementation."],
        actions: ["Correct the proven mechanical flow, sensing, synchronization, or upstream/downstream condition.", "Verify stable container handling through the affected speed/product range."],
        safety: [OBSERVE, LOTO, MOTION], sourceRefs: []
      },
      {
        id: "universal-orientation-vision", universalFamilyId: "orientation-vision", code: "UNIVERSAL — ORIENTATION / VISION", category: "Universal / Orientation & Vision",
        aliases: ["bottle orientation", "orientation camera", "wrong plate", "image sequence", "framegrabber", "emboss orientation", "camera trigger"],
        title: "Orientation / vision acquisition or result association is incorrect",
        summary: "Use this method for bottle orientation, camera acquisition, image sequence, trigger, framegrabber, learned-feature, correction, or result-to-container/plate association problems. Geometry, addresses and calibration values are machine/version specific.",
        probableCauses: ["Image/trigger acquisition is missing, unstable, or associated with the wrong container/plate.", "Optics, lighting, target feature, bottle presentation, or learned image quality is inadequate.", "RPC/table/encoder synchronization or result timing is incorrect.", "Commissioning/configuration differs from the approved machine/product baseline."],
        checks: ["Separate no image, poor image, wrong orientation correction, and wrong-container/plate association.", "Determine whether the issue is present at low speed, only at speed, or only on specific containers/features.", "Verify clean optics/lighting and stable container presentation before software adjustment.", "Check trigger/image/result sequence and synchronization using the machine's approved diagnostic method.", "Do not reuse IP addresses, plate geometry, correction angles, or timing values from a different machine merely because the hardware looks similar."],
        actions: ["Correct the proven optics/presentation, acquisition, synchronization, association, or commissioned-configuration issue.", "Revalidate across the intended speed/product range after the approved correction."],
        safety: [OBSERVE, LOTO, MOTION], sourceRefs: []
      },
      {
        id: "universal-inspection-coder", universalFamilyId: "inspection-coder", code: "UNIVERSAL — INSPECTION / CODER", category: "Universal / Inspection & Coding",
        aliases: ["inspection not ready", "heuft fault", "laser coder fault", "dating fault", "reject fault", "label inspection"],
        title: "Inspection / coding subsystem is not ready or reporting a fault",
        summary: "Use this method for inspection, reject, label-check, coder/laser, or dating systems. First determine whether the labeler is reporting a true downstream device fault, a readiness/interface problem, or a process/quality event.",
        probableCauses: ["The external subsystem reports its own device/process fault.", "Ready/fault/interface signals disagree between systems.", "The inspection/reject/coder process condition is real and product-dependent.", "A communication/power condition is making the subsystem appear unavailable."],
        checks: ["Read the downstream subsystem's own diagnostic first when available.", "Separate device fault, not-ready/interface, communication/power, and actual reject/quality events.", "Compare labeler-side indication with the subsystem-side indication.", "Preserve chronology when a downstream device fault creates later machine summary alarms.", "Use machine-specific interface tags only as local Analyzer evidence."],
        actions: ["Correct the proven downstream device, interface, power/communication, or process condition.", "Verify ready/fault signaling and normal product handling after recovery."],
        safety: [OBSERVE, LOTO, ELECTRICAL], sourceRefs: []
      },
      {
        id: "universal-utilities", universalFamilyId: "utilities", code: "UNIVERSAL — UTILITIES", category: "Universal / Utilities",
        aliases: ["low air", "air pressure fault", "lubrication fault", "grease fault", "cooling fault", "extractor fault", "utility fault"],
        title: "Machine utility / service supply is outside expected condition",
        summary: "Use this method for compressed air, lubrication, cooling, extraction, or another required machine utility. Exact pressure thresholds, timers, switch points and device designations are machine-specific and must not be copied between installations.",
        probableCauses: ["The utility is genuinely unavailable or below/above the machine's required condition.", "A sensor/switch/feedback path disagrees with the actual utility condition.", "A pump/fan/valve/drive/protection condition prevents the utility from operating.", "A later machine fault is secondary to the utility loss."],
        checks: ["Determine the affected utility and whether the condition is machine-wide or subsystem-specific.", "Compare actual indicated utility condition with the machine's normal diagnostic feedback.", "Check earlier power/protection/device faults before adjusting thresholds.", "Use the approved machine-specific specification for any numeric limit or timing comparison.", "Use Analyzer evidence to locate local logic only; do not treat source preset values as universal recommendations."],
        actions: ["Restore the proven utility supply, sensing, device, or power/protection condition.", "Verify normal machine operation without recurring utility alarms."],
        safety: [OBSERVE, LOTO, ELECTRICAL], sourceRefs: []
      },
      {
        id: "universal-hmi-runtime", universalFamilyId: "hmi-runtime", code: "UNIVERSAL — HMI / RUNTIME", category: "Universal / HMI & Runtime",
        aliases: ["hmi fault", "touchscreen issue", "runtime stopped", "zenon issue", "panel fault", "diagviewer", "hmi communication"],
        title: "HMI / runtime / service-computer layer needs isolation",
        summary: "Use this method when the operator interface, runtime, project, panel, or service computer is malfunctioning or not communicating. Separate an HMI-only problem from a controller/machine problem before changing projects, network settings, or panel configuration.",
        probableCauses: ["The HMI/runtime is stopped, unresponsive, or has a project/workspace issue.", "The panel and controller are not communicating.", "Panel/network/time/storage/service-computer conditions are affecting runtime.", "The machine/controller is healthy and only the visualization layer is affected."],
        checks: ["Determine whether the machine/controller remains operational while only visualization is affected.", "Check normal panel/runtime status and communication diagnostics before changing configuration.", "Preserve backups and current project identity before any service-level project/update action.", "Treat network addresses, project names, credentials and service-tool procedures as installation/version-specific.", "Use read-only log/diagnostic viewers when available before making configuration changes."],
        actions: ["Correct the proven runtime/panel/communication/project condition using the approved version/site procedure.", "Reconfirm machine/controller communication and operator visualization after recovery."],
        safety: [OBSERVE, ELECTRICAL], sourceRefs: []
      }
    ].map((entry) => Object.freeze({
      ...entry,
      methodClass: "universal",
      contextHints: ["universal", entry.universalFamilyId],
      universalBoundary: "This method is intentionally tag-, site-, fault-number-, and address-independent. Machine-specific source evidence may be shown separately when available."
    })));

    const methodByFamily = new Map(methods.map((entry) => [entry.universalFamilyId, entry]));
    const baseEntries = base.entries;
    const entries = Object.freeze([...methods, ...baseEntries]);
    const baseGetEntry = base.getEntry.bind(base);
    const baseSearchEntries = base.searchEntries.bind(base);
    const baseRecommendFlows = typeof base.recommendFlows === "function" ? base.recommendFlows.bind(base) : () => base.flows || [];

    function getEntry(id) {
      return methods.find((entry) => entry.id === id) || baseGetEntry(id);
    }

    function searchEntries(query, context = {}, limit = 8) {
      const count = Math.max(1, Number(limit) || 8);
      const direct = universal.classifyText(query);
      const preferred = direct ? methodByFamily.get(direct.familyId) : null;
      const ranked = baseSearchEntries(query, context, Math.max(count, 8));
      const seen = new Set();
      return [preferred, ...ranked]
        .filter((entry) => entry && !seen.has(entry.id) && seen.add(entry.id))
        .slice(0, count);
    }

    const universalFlow = Object.freeze({
      id: "universal-fault-isolation-flow",
      category: "Universal troubleshooting",
      title: "Universal fault isolation",
      description: "Start from the observed failure family. Machine/site-specific tags and fault numbers are evidence overlays, not the diagnostic method.",
      start: "system",
      nodes: Object.freeze({
        system: Object.freeze({
          question: "Which failure family best matches what you are seeing?",
          help: "Choose the observable system/problem. You can attach Analyzer evidence later without changing this method.",
          choices: Object.freeze(methods.map((entry) => Object.freeze({ label: entry.title, result: entry.id })))
        })
      })
    });
    const flows = Object.freeze([universalFlow, ...(base.flows || [])]);

    function getFlow(id) {
      return id === universalFlow.id ? universalFlow : base.getFlow?.(id) || null;
    }

    function recommendFlows(context = {}) {
      const ranked = baseRecommendFlows(context).filter((flow) => flow?.id !== universalFlow.id);
      return [Object.freeze({ ...universalFlow, contextScore: 1 }), ...ranked];
    }

    function validate() {
      const current = typeof base.validate === "function" ? base.validate() : { ok: true, errors: [] };
      const errors = [...(current.errors || [])];
      const ids = new Set(baseEntries.map((entry) => entry.id));
      for (const method of methods) {
        if (ids.has(method.id)) errors.push(`Universal method duplicates existing entry id ${method.id}.`);
        if (!universal.family(method.universalFamilyId)) errors.push(`Universal method ${method.id} uses unknown family ${method.universalFamilyId}.`);
        if (!Array.isArray(method.safety) || !method.safety.length) errors.push(`Universal method ${method.id} has no safety boundary.`);
      }
      if (!universalFlow.nodes.system.choices.every((choice) => getEntry(choice.result))) errors.push("Universal fault isolation flow has an unresolved result.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+universal-methods-v370`,
      entries,
      flows,
      getEntry,
      getFlow,
      searchEntries,
      recommendFlows,
      getUniversalMethod(familyId) { return methodByFamily.get(String(familyId || "")) || null; },
      universalMethods: methods,
      validate
    });
  };
});
