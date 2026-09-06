"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const extend = require(path.join(root, "app/troubleshooting/troubleshooting-search-precedence.js"));

function makeBase() {
  const code600 = Object.freeze({ id: "servo-terminal-code-600", code: "600", title: "RPC terminal communication absent" });
  const unrelated = Object.freeze({ id: "topmodul-00067-secondary-no-motion", code: "00067 — CHECK MOTION", title: "Determine whether 00067 is secondary to a no-motion condition" });
  const apl = Object.freeze({ id: "apl-aggregate-connection", code: "APL AGGREGATE CONNECTION", title: "APL aggregate connection / docking path" });
  const orientation = Object.freeze({
    id: "orientation-trigger-geometry-baseline",
    code: "ORIENTATION TRIGGER GEOMETRY",
    title: "Verify orientation trigger geometry against the machine baseline",
    aliases: Object.freeze(["distance between rotary plates", "table diameter", "orientation geometry baseline"])
  });
  return Object.freeze({
    version: "test-search-stack",
    entries: Object.freeze([unrelated, apl, orientation, code600]),
    normalize(value) { return String(value || "").trim().toLowerCase(); },
    searchEntries(query, context, limit = 8) {
      if (String(query).trim() === "600" && String(context.applicationMode).toLowerCase() === "apl") {
        return [unrelated, apl, code600].slice(0, limit);
      }
      if (String(query).trim().toLowerCase() === "rotary plate distance") {
        return [unrelated, apl, orientation].slice(0, limit);
      }
      return [unrelated, apl].slice(0, limit);
    },
    validate() { return { ok: true, errors: [] }; }
  });
}

test("v360 exact code match outranks APL context-ranked records", () => {
  const library = extend(makeBase());
  const matches = library.searchEntries("600", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(matches[0].id, "servo-terminal-code-600");
  assert.equal(matches.filter((entry) => entry.id === "servo-terminal-code-600").length, 1);
});

test("v360 exact matcher recognizes compact codes and exact ids", () => {
  const library = extend(makeBase());
  assert.deepEqual(library.getExactSearchMatches("600").map((entry) => entry.id), ["servo-terminal-code-600"]);
  assert.deepEqual(library.getExactSearchMatches("servo-terminal-code-600").map((entry) => entry.id), ["servo-terminal-code-600"]);
});

test("v360 preserves existing ranking when there is no exact code or id", () => {
  const library = extend(makeBase());
  const matches = library.searchEntries("encoder no motion", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.deepEqual(matches.map((entry) => entry.id), ["topmodul-00067-secondary-no-motion", "apl-aggregate-connection"]);
});

test("v367 hotfix treats natural rotary-plate wording as a strong alias match", () => {
  const library = extend(makeBase());
  const matches = library.searchEntries("rotary plate distance", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(matches[0].id, "orientation-trigger-geometry-baseline");
  assert.deepEqual(library.getAliasSearchMatches("rotary plate distance").map((entry) => entry.id), ["orientation-trigger-geometry-baseline"]);
});

test("v360 validation asserts exact and natural-alias precedence when the records exist", () => {
  const library = extend(makeBase());
  const result = library.validate();
  assert.equal(result.ok, true, result.errors.join(" | "));
  assert.match(library.version, /search-precedence-v360/);
});
