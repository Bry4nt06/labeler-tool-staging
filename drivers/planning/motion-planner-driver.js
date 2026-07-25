(function (global) {
  "use strict";

  const INTENTS = Object.freeze({
    HOLD: "HOLD",
    ROTATE: "ROTATE",
    START: "START",
    MAINTAIN: "MAINTAIN",
    CHANGE_SPEED: "CHANGE_SPEED",
    SPECIAL: "SPECIAL",
    STOP: "STOP"
  });

  const EVENT_TYPES = Object.freeze({
    STARTUP: "STARTUP",