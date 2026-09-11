"use strict";

(function installDts3CommandSemanticsDriver(global) {
  if (global.LabelerDts3CommandSemanticsDriver) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LabelerDts3CommandSemanticsDriver;
    return;
  }

  const COMMANDS = Object.freeze({
    ELGA: Object.freeze({ mnemonic: "ELGa", name: "Electronic gear, absolute", targetMode: "absolute" }),
    ELGR: Object.freeze({ mnemonic: "ELGr", name: "Electronic gear, relative", targetMode: "relative" }),
    EPGA: Object.freeze({ mnemonic: "EPGa", name: "Electronic positional gear, absolute", targetMode: "absolute" }),
    EPGR: Object.freeze({ mnemonic: "EPGr", name: "Electronic positional gear, relative", targetMode: "relative" })
  });

  function finite(value, fallback = NaN) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function machineToken(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  }

  function isDts3Machine(machineType) {
    const token = machineToken(machineType);
    return token.includes("TOPMODUL") && token.includes("DTS3");
  }

  function commandKey(value) {
    return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  }

  function commandDefinition(value) {
    return COMMANDS[commandKey(value)] || null;
  }

  function resolveTarget(startPlateDeg, mnemonic, parameter2) {
    const definition = commandDefinition(mnemonic);
    const start = finite(startPlateDeg, 0);
    const p2 = finite(parameter2, start);
    if (!definition) return p2;
    return definition.targetMode === "absolute" ? p2 : start + p2;
  }

  function resolveTravel(startPlateDeg, mnemonic, parameter2) {
    const start = finite(startPlateDeg, 0);
    return resolveTarget(start, mnemonic, parameter2) - start;
  }

  function annotateRows(rows, options = {}) {
    const source = Array.isArray(rows) ? rows : [];
    const machineType = options.machineType || "";
    if (!isDts3Machine(machineType)) return source.map((row) => ({ ...row }));
    const tablePosition = typeof options.tablePosition === "function"
      ? options.tablePosition
      : (value) => finite(value, value);

    let correctionOrdinal = 0;
    return source.map((row, index) => {
      const next = source[index + 1];
      if (Number(row?.cmd) !== 7 || !next) {
        correctionOrdinal = 0;
        return {
          ...row,
          dts3CommandMnemonic: null,
          dts3CommandRole: Number(row?.cmd) === 3 ? "reference" : null
        };
      }

      correctionOrdinal += 1;
      const startPlateDeg = finite(row?.plateAngle, 0);
      const targetPlateDeg = finite(next?.plateAngle, startPlateDeg);
      const stopTablePosition = tablePosition(next?.tableAngle);
      return {
        ...row,
        dts3CommandMnemonic: "ELGa",
        dts3CommandName: COMMANDS.ELGA.name,
        dts3CommandRole: "correction-turn",
        dts3CommandTargetMode: "absolute",
        dts3CommandParameter1: stopTablePosition,
        dts3CommandParameter2: targetPlateDeg,
        dts3CommandStartPlateDeg: startPlateDeg,
        dts3CommandTargetPlateDeg: resolveTarget(startPlateDeg, "ELGa", targetPlateDeg),
        dts3CommandTravelDeg: resolveTravel(startPlateDeg, "ELGa", targetPlateDeg),
        dts3CorrectionOrdinal: correctionOrdinal,
        machineCommand: "ELGa",
        machineCommandName: COMMANDS.ELGA.name
      };
    });
  }

  const api = Object.freeze({
    COMMANDS,
    isDts3Machine,
    commandDefinition,
    resolveTarget,
    resolveTravel,
    annotateRows
  });

  global.LabelerDts3CommandSemanticsDriver = api;
  global.LabelerDriverRegistry?.register?.("servo.dts3CommandSemantics", api, {
    version: 1,
    responsibilities: ["dts3-command-mnemonics", "elga-absolute-target", "dts3-correction-turn-translation"]
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
