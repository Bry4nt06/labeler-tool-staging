"use strict";

(function installTopModulRpcMethodBridge(root, factory) {
  const extendLibrary = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = extendLibrary;
  if (root?.ServoForgeTroubleshootingLibrary) root.ServoForgeTroubleshootingLibrary = extendLibrary(root.ServoForgeTroubleshootingLibrary);
})(typeof globalThis !== "undefined" ? globalThis : this, function createTopModulRpcMethodBridgeExtension() {
  return function extendLibrary(base) {
    if (!base?.getTopModulFault || !base?.getEntry) {
      throw new Error("TopModul Labeler diagnostic layers are required before RPC method bridging.");
    }

    const decoderCodes = Object.freeze({
      512: 16,
      513: 17,
      514: 111,
      515: 33,
      516: 112,
      517: 35,
      518: 36,
      519: 102,
      521: 38,
      522: 100,
      523: 40,
      524: 120,
      525: 121,
      526: 256,
      527: 1984,
      528: 130,
      529: 101,
      532: 110
    });

    const methodMap = Object.freeze({
      512: "servo-power-timeout",
      513: "servo-enable-timeout",
      514: "servo-power-loss",
      515: "servo-feedback",
      516: "servo-malfunction",
      517: "servo-transition",
      518: "servo-status",
      521: "servo-reset",
      522: "servo-enumeration",
      523: "servo-mode-switch",
      524: "encoder-continuity",
      525: "encoder-direction",
      528: "io-box-communication",
      529: "servo-version"
    });

    const unpromotedReasons = Object.freeze({
      519: "Fault 519 is labeled 'Servo Bottle Table Scan' in the supplied Labeler alarm table. The PowerPC decoder maps message code 102 to this bit, but the archived Danfoss fault document does not identify a 'Scan' fault name or explicitly equate code 102 with SERVOCOUNT. ServoForge keeps the decoder binding without borrowing the SERVOCOUNT procedure.",
      526: "Fault 526 is labeled 'Internal Fault'. The PowerPC decoder maps message code 256, but the archived Danfoss fault document does not establish which documented servo fault name that code represents. No RPC method is promoted.",
      527: "Fault 527 is labeled 'Test Message'. The PowerPC decoder maps message code 1984. The archived procedure reserves Fault #18 TEST for testing, but the supplied source does not prove that PowerPC code 1984 is that same condition. No service procedure is promoted from the similarity alone.",
      532: "Fault 532 is labeled 'Lag Error' and maps PowerPC message code 110. The archived Danfoss fault-message document supplied to ServoForge does not contain a LAG ERROR procedure, so the PLC decoder evidence is retained without fabricating one."
    });

    function rpcMethodFor(number) {
      const methodId = methodMap[Number(number)];
      if (!methodId) return null;
      const method = base.getEntry(methodId);
      if (!method || method.plcFault) return null;
      return Object.freeze({
        status: "verified-topmodul-to-archived-rpc-method",
        topModulFault: Number(number),
        powerPcMessageCode: decoderCodes[Number(number)],
        methodId,
        code: method.code,
        number: method.number,
        category: method.category,
        title: method.title,
        summary: method.summary,
        probableCauses: Object.freeze([...(method.probableCauses || [])]),
        checks: Object.freeze([...(method.checks || [])]),
        actions: Object.freeze([...(method.actions || [])]),
        safety: Object.freeze([...(method.safety || [])]),
        sourceRefs: Object.freeze((method.sourceRefs || []).map((ref) => Object.freeze({ ...ref }))),
        sourceDiscipline: `TopModul Fault ${number} is bound to PowerPC decoder message code ${decoderCodes[Number(number)]} in the readable LB1 PLC. The operator-facing alarm wording is consistent with archived RPC method ${method.code}; the method is therefore reused without changing its OEM/procedure content.`
      });
    }

    function rpcGapFor(number) {
      const reason = unpromotedReasons[Number(number)];
      if (!reason) return null;
      return Object.freeze({
        status: "decoder-bound-rpc-method-not-promoted",
        topModulFault: Number(number),
        powerPcMessageCode: decoderCodes[Number(number)],
        reason
      });
    }

    function isLabelerServoTableEntry(entry) {
      if (!entry?.plcFault || entry.diagnosticScope === "Station") return false;
      const n = Number(entry.number);
      return Number.isInteger(n) && n >= 512 && n <= 532;
    }

    function enrich(entry) {
      if (!isLabelerServoTableEntry(entry)) return entry;
      const method = rpcMethodFor(entry.number);
      const gap = rpcGapFor(entry.number);
      if (!method && !gap) return entry;
      return Object.freeze({
        ...entry,
        ...(method ? { rpcMethod: method } : {}),
        ...(gap ? { rpcMethodGap: gap } : {})
      });
    }

    const getEntry = (id) => enrich(base.getEntry(id));
    const getTopModulFault = (value) => enrich(base.getTopModulFault(value));
    const searchEntries = (query, context = {}, limit = 8) => base.searchEntries(query, context, limit).map(enrich);
    const getTopModulFaultRelations = (value, limit = 10) => base.getTopModulFaultRelations(value, limit).map(enrich);
    const getTopModulFirstFaultCandidates = (value, limit = 8) => base.getTopModulFirstFaultCandidates(value, limit).map(enrich);

    function getTopModulFaultDrillDown(value, limit = 10) {
      const original = base.getTopModulFaultDrillDown(value, limit);
      if (!original) return null;
      const entry = enrich(original.entry);
      return Object.freeze({
        ...original,
        entry,
        related: (original.related || []).map(enrich),
        firstFaultCandidates: (original.firstFaultCandidates || []).map(enrich),
        rpcMethod: entry.rpcMethod || null,
        rpcMethodGap: entry.rpcMethodGap || null
      });
    }

    function validate() {
      const current = base.validate();
      const errors = [...(current.errors || [])];
      const expected = Object.keys(methodMap).map(Number);
      for (const number of expected) {
        const entry = getTopModulFault(number);
        if (!entry?.rpcMethod) errors.push(`TopModul Fault ${number} lost its verified RPC method bridge.`);
        if (entry?.rpcMethod?.powerPcMessageCode !== decoderCodes[number]) errors.push(`TopModul Fault ${number} lost its PowerPC message-code binding.`);
      }
      for (const number of Object.keys(unpromotedReasons).map(Number)) {
        const entry = getTopModulFault(number);
        if (!entry?.rpcMethodGap || entry.rpcMethod) errors.push(`TopModul Fault ${number} must retain decoder evidence without an RPC method.`);
      }
      if (getTopModulFault(512)?.rpcMethod?.code !== "SERVOPOWER_TIMEOUT") errors.push("Fault 512 lost SERVOPOWER_TIMEOUT method binding.");
      if (getTopModulFault(515)?.rpcMethod?.code !== "SERVOFEEDBACK") errors.push("Fault 515 lost SERVOFEEDBACK method binding.");
      if (getTopModulFault(524)?.rpcMethod?.code !== "ENCODERCONTINUITY") errors.push("Fault 524 lost ENCODERCONTINUITY method binding.");
      if (getTopModulFault(528)?.rpcMethod?.code !== "IOBOXCOMM") errors.push("Fault 528 lost IOBOXCOMM method binding.");
      if (getTopModulFault(529)?.rpcMethod?.code !== "SERVOVERSION") errors.push("Fault 529 lost SERVOVERSION method binding.");
      if (getTopModulFault(520)?.rpcMethod || getTopModulFault(520)?.rpcMethodGap) errors.push("Fault 520 must remain governed by its existing Labeler source-gap evidence, not the RPC bridge.");
      return { ok: errors.length === 0, errors };
    }

    return Object.freeze({
      ...base,
      version: `${base.version}+topmodul-rpc-method-bridge-v1`,
      getEntry,
      getTopModulFault,
      searchEntries,
      getTopModulFaultRelations,
      getTopModulFirstFaultCandidates,
      getTopModulFaultDrillDown,
      topModulRpcMethodFaults: Object.freeze(Object.keys(methodMap).map(Number)),
      topModulRpcMethodGapFaults: Object.freeze(Object.keys(unpromotedReasons).map(Number)),
      validate
    });
  };
});
