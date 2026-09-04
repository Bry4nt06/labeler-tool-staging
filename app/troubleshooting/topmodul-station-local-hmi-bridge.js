"use strict";

(function installTopModulStationLocalHmiBridge(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulStationLocalHmiBridgeExtension() {
  return function extendLibrary(base) {
    if (!base?.getStationFaultTemplate || !base?.getStationFaultVariant || !base?.getStationControllerTrace || !base?.searchEntries) {
      throw new Error("Shared TopModul Station scope and transport layers are required before local-HMI code bridging.");
    }

    const CART_SOURCE_ID = "topmodul-co85-lb1-aplcart1-l5k";
    const LIVE_00067_ID = "topmodul-00067-labeler-encoder-feedback";
    const HMI_MESSAGES = Object.freeze({
      1: "E-STOP FROM MAIN MACHINE",
      2: "I/O CONTROLLER FAULT",
      3: "GUARD DOOR OPEN",
      4: "GUARD DOOR CLOSED - PRESS RESET",
      5: "MAIN CONTACTOR FAULTED",
      6: "SERVO CONTROL VOLTAGE CB TRIPPED",
      7: "FEED / REWIND UNIT CB TRIPPED",
      8: "CARRIAGE NOT PULLED BACK",
      9: "FEED UNIT MOTOR FAULT",
      10: "REWIND UNIT MOTOR FAULT",
      11: "ETH MOD SLOT 1 (LEVEL 1) FAULTED",
      12: "ETH MOD SLOT 2 (LEVEL 3) FAULTED",
      13: "ETH MOD SLOT 4 (LEVEL3 HMI) FLT",
      14: "BASE MACHINE COMMUNICATION FAULT",
      15: "DIG.OUTPUT MODUL EL.FUSE TRIPPED",
      16: "MOTION GROUP NOT SYNCHRONIZED",
      17: "SERVO AXIS FEEDBACK ON FAULT",
      18: "SYNCHRON DISTANCE < 0",
      19: "INVALID LABEL LENGTH / CHANGE PARA",
      20: "PRESS RESET IF CARRIAGE IN FRONT",
      21: "MISSING SIGNAL FOR REFERENCE RUN",
      22: "LABEL LENGTH MEASURMENT FAULT",
      23: "WEB BREAK SENSOR ACTUATED",
      24: "REFERENCE SENSOR NO SIGNAL",
      25: "NO LABELS / END OF REEL",
      26: "LOOP BUFFER FAULT AT FEED UNIT",
      27: "INVALID SENSOR STATUS LOOP BUFFER",
      28: "REWINDER WEB JAM",
      29: "REWINDER WEB BREAK AFTER HEAD",
      30: "LABELER ENCODER FAULT",
      31: "SYNCHRONIZATION LOST DURING RUN",
      32: "SERVO AXIS COMMUTATION FAULT",
      33: "SERVO AXIS CONTROL VOLTAGE FAULT",
      34: "SERVO AXIS DRIVE COOLING FAULT",
      35: "SERVO AXIS DRIVE HARD FAULT",
      36: "SERVO AXIS DRIVE OVERCURRENT FAULT",
      37: "SERVO AXIS DRIVE OVERTEMP. FAULT",
      38: "SERVO AXIS DRIVE OVERVOLTAGE FAULT",
      39: "SERVO AXIS DRIVE UNDERVOLTAGE FLT",
      40: "SERVO AXIS FAULT",
      41: "SERVO AXIS GROUND SHORT FAULT",
      42: "SERVO AXIS MODULE FAULT",
      43: "SERVO AXIS HARDWARE FAULT",
      44: "SERVO AXIS MODULE SYNC FAULT",
      45: "SERVO AXIS MOTOR FEEDBACK FLT",
      46: "SERVO AX. MOTOR FEEDBACK NOISE FLT",
      47: "SERVO AXIS DRIVE OVERLOAD FAULT",
      48: "SERVO AXIS OVERTEMPERATURE FAULT",
      49: "SERVO AXIS OUT OF POSITION FAULT",
      50: "SERVO AXIS OVERSPEED FAULT",
      51: "SERVO AXIS POSITION ERROR FAULT",
      52: "SERVO AXIS POWER PHASE LOSS FAULT",
      53: "SERVO AXIS SERCOS RING FAULT",
      54: "SERVO AXIS TIMER EVENT FAULT",
      60: "REWINDER FULL - REMOVE CORE",
      64: "LABELER ENCODER MODULE FAULT",
      65: "LABELER ENCODER MODULE HARDW FAULT",
      66: "LABELER ENCODER SYNC FAULT",
      67: "LABELER ENCODER FEEDBACK FAULT",
      68: "LABELER ENCODER FEEDBACK NOISE FLT",
      69: "LABELER ENCODER TIMER EVENT FAULT",
      74: "HEIGTH ADJUSTMENT CB TRIPPED"
    });

    const OFFSETS = Object.freeze(Object.keys(HMI_MESSAGES).map(Number).sort((a, b) => a - b));
    const localCode = (offset) => String(Number(offset)).padStart(5, "0");
    const localAddress = (offset) => `Faults[${Math.floor(Number(offset) / 16)}].${Number(offset) % 16}`;

    function globalMap(offset) {
      return Object.freeze(Array.from({ length: 6 }, (_, index) => {
        const station = index + 1;
        const variant = base.getStationFaultVariant(offset, station);
        return Object.freeze({
          station,
          globalNumber: Number(variant?.number),
          globalCode: variant?.code || "",
          globalAddress: variant?.plcFault?.address || "",
          entryId: variant?.id || "",
          title: variant?.title || ""
        });
      }));
    }

    function addSourceRef(refs, offset) {
      const locator = `Cart 1 English HMI fault-message table — ${localCode(offset)} ${HMI_MESSAGES[offset]}; local PLC address ${localAddress(offset)}`;
      const next = [...(refs || [])];
      if (!next.some((ref) => ref.sourceId === CART_SOURCE_ID && ref.locator === locator)) next.unshift(Object.freeze({ sourceId: CART_SOURCE_ID, locator }));
      return Object.freeze(next);
    }

    function buildLocalEntry(offset) {
      const n = Number(offset);
      if (!HMI_MESSAGES[n]) return null;
      if (n === 67) {
        const live = base.getEntry?.(LIVE_00067_ID) || base.searchEntries("00067", { machineType: "TopModul" }, 3)[0];
        return live?.id === LIVE_00067_ID ? live : null;
      }
      const template = base.getStationFaultTemplate(n);
      if (!template) return null;
      const transport = base.getStationControllerTrace(n);
      const map = globalMap(n);
      const meta = Object.freeze({
        status: "cart1-local-hmi-message-and-shared-station-offset-bound",
        localNumber: n,
        localCode: localCode(n),
        localAddress: localAddress(n),
        operatorMessage: HMI_MESSAGES[n],
        controller: "CO85_LB1_APLCart_1",
        stationTemplateOffset: n,
        directProducer: transport?.directTriggerTag || null,
        transportWord: transport?.cartDataWord || null,
        globalByStation: map,
        sourceDiscipline: "The English 000xx operator message is directly verified in the supplied Cart 1 L5K. The shared Station fault offset and six base-Labeler destination blocks are verified across Stations 1-6. Exact HMI text on Carts 2-6 is not claimed as independently source-verified without their readable exports."
      });
      return Object.freeze({
        ...template,
        id: `topmodul-station-local-hmi-${localCode(n)}`,
        code: localCode(n),
        number: null,
        title: HMI_MESSAGES[n],
        category: `TopModul / Station local HMI / ${template.plcFault?.family || "Fault"}`,
        aliases: Object.freeze([...new Set([localCode(n), HMI_MESSAGES[n], template.title, ...(template.aliases || [])])]),
        summary: `Cart-local HMI ${localCode(n)} is the shared Station fault position ${n}: ${HMI_MESSAGES[n]}. ServoForge reuses the existing Station '${template.title}' diagnostic method rather than creating six copies. If the physical Station position is known, use the mapping panel to open the exact transported base-Labeler global fault and Faults_LB1 bit. Cart 1 provides the exact local HMI text authority; Stations 1-6 provide the verified shared offset/global destination structure.`,
        sourceRefs: addSourceRef(template.sourceRefs, n),
        diagnosticScope: "Station local HMI",
        canonicalFaultId: template.id,
        stationTemplateOffset: n,
        stationVariants: template.stationVariants,
        plcFault: undefined,
        localHmiFault: meta,
        stationControllerTrace: transport || template.stationControllerTrace || null
      });
    }

    function parseLocalCode(value) {
      const raw = String(value ?? "");
      const match = raw.match(/(?:^|\D)(000\d{2})(?=\D|$)/);
      if (!match) return null;
      const offset = Number(match[1]);
      return HMI_MESSAGES[offset] ? offset : null;
    }

    function getStationLocalHmiFault(value) {
      const offset = parseLocalCode(value);
      return offset == null ? null : buildLocalEntry(offset);
    }

    function getEntry(id) {
      const match = /^topmodul-station-local-hmi-(\d{5})$/.exec(String(id || ""));
      if (match) return buildLocalEntry(Number(match[1]));
      return base.getEntry(id);
    }

    function searchEntries(query, context = {}, limit = 8) {
      const requested = Math.max(1, Number(limit) || 8);
      const local = getStationLocalHmiFault(query);
      if (!local) return base.searchEntries(query, context, requested);
      const combined = [{ ...local, searchScore: 320 }, ...base.searchEntries(query, context, requested + 8)];
      const seen = new Set();
      return combined.filter((entry) => {
        if (!entry || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      }).slice(0, requested);
    }

    const sources = Object.freeze((base.sources || []).map((source) => {
      if (source.id !== CART_SOURCE_ID) return source;
      return Object.freeze({
        ...source,
        notes: `${source.notes || ""} v348 also indexes the Cart 1 English local-HMI message table: 62 named 000xx fault positions map one-for-one to the existing 62 shared Station template offsets. The exact operator text is Cart 1 authority; the six Labeler destination blocks validate the shared Station offset structure.`.trim()
      });
    }));

    function getSource(id) {
      return sources.find((source) => source.id === id) || base.getSource?.(id) || null;
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      if (OFFSETS.length !== 62) errors.push(`Expected 62 Cart-local named HMI positions, found ${OFFSETS.length}.`);
      for (const offset of OFFSETS) {
        if (!base.getStationFaultTemplate(offset)) errors.push(`Local HMI ${localCode(offset)} has no shared Station template offset ${offset}.`);
      }
      const endReel = getStationLocalHmiFault("00025");
      if (endReel?.localHmiFault?.operatorMessage !== "NO LABELS / END OF REEL") errors.push("Local HMI 00025 lost exact Cart 1 operator text.");
      if (endReel?.stationTemplateOffset !== 25 || endReel?.plcFault !== undefined) errors.push("Local HMI 00025 must remain a local-HMI view of Station template 25, not a base PLC fault.");
      const encoderMonitor = getStationLocalHmiFault("00030 LABELER ENCODER FAULT");
      if (encoderMonitor?.stationTemplateOffset !== 30 || encoderMonitor?.localHmiFault?.localAddress !== "Faults[1].14") errors.push("Local HMI 00030 lost Station offset/address binding.");
      const live67 = getStationLocalHmiFault("00067");
      if (live67?.id !== LIVE_00067_ID || live67?.stationLocalFault?.producer !== "BaseMachineEncoderAxis.FeedbackFault") errors.push("Local HMI resolver must preserve the source-proven v347 00067 field entry.");
      const height = getStationLocalHmiFault("00074");
      if (height?.stationTemplateOffset !== 74 || height?.localHmiFault?.globalByStation?.[5]?.globalNumber !== 1498) errors.push("Local HMI 00074 lost six-Station global mapping.");
      if (getStationLocalHmiFault("00055") !== null) errors.push("Unassigned local HMI position 00055 must not create a fake diagnostic.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+station-local-hmi-bridge-v1`,
      sources,
      getSource,
      getEntry,
      searchEntries,
      getStationLocalHmiFault,
      topModulStationLocalHmiMessages: HMI_MESSAGES,
      topModulStationLocalHmiOffsets: OFFSETS,
      validate
    });
  };
});
