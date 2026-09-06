"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const base = require(path.join(root, "app/troubleshooting/diagnostic-library.js"));
const live = require(path.join(root, "app/troubleshooting/topmodul-live-diagnostics.js"))(base);
const data = require(path.join(root, "app/troubleshooting/topmodul-plc-fault-data.js"));
const catalog = require(path.join(root, "app/troubleshooting/topmodul-plc-fault-catalog.js"))(live, data);
const drill = require(path.join(root, "app/troubleshooting/topmodul-fault-drilldown.js"))(catalog);
const scope = require(path.join(root, "app/troubleshooting/topmodul-station-scope.js"))(drill);
const transport = require(path.join(root, "app/troubleshooting/topmodul-station-controller-trace.js"))(scope);
const cause = require(path.join(root, "app/troubleshooting/topmodul-station-cause-model.js"))(transport);
const labelerCause = require(path.join(root, "app/troubleshooting/topmodul-labeler-cause-model.js"))(cause);
const circuit = require(path.join(root, "app/troubleshooting/topmodul-circuit-trace.js"))(labelerCause);
const power = require(path.join(root, "app/troubleshooting/topmodul-station-power-circuit.js"))(circuit);
const encoder = require(path.join(root, "app/troubleshooting/topmodul-station-encoder-circuit.js"))(power);
const servo = require(path.join(root, "app/troubleshooting/topmodul-station-servo-circuit.js"))(encoder);
const communication = require(path.join(root, "app/troubleshooting/topmodul-station-communication-circuit.js"))(servo);
const processTrace = require(path.join(root, "app/troubleshooting/topmodul-station-process-trace.js"))(communication);
const stationFoundation = require(path.join(root, "app/troubleshooting/topmodul-station-foundation-circuit.js"))(processTrace);
const aplFoundation = require(path.join(root, "app/troubleshooting/apl-cart-foundation.js"))(stationFoundation);
const library = require(path.join(root, "app/troubleshooting/apl-cart-core-status.js"))(aplFoundation);
const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

const supported = [1, 2, 3, 4, 20, 31];
const code = (number) => String(number).padStart(5, "0");

test("v364 closes the remaining meaningful low/mid Cart-local fault identities", () => {
  assert.deepEqual([...library.aplCartCoreFaults], supported);
  for (const number of supported) {
    assert.ok(library.getEntry(`apl-cart-${code(number)}`), `missing Cart-local entry ${code(number)}`);
    assert.ok(library.getAplCartCorePlan(number), `missing core plan ${code(number)}`);
  }
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join(" | "));
});

test("00001 reuses the shared CR202/CR204 safety circuit and preserves two independent feedback branches", () => {
  const plan = library.getAplCartCorePlan(1);
  assert.match(plan.producer, /CR202/);
  assert.match(plan.producer, /I0005\.04/);
  assert.match(plan.producer, /CR204/);
  assert.match(plan.producer, /I0005\.05/);
  assert.match(plan.producer, /PowerOnReset/);
  assert.ok(plan.circuitTrace.deviceRows.some((row) => row.device === "CR202"));
  assert.ok(plan.circuitTrace.deviceRows.some((row) => row.device === "CR204"));
  assert.ok(plan.circuitTrace.drawingLocations.some((row) => row.pdfPage === 42));
});

test("00002 keeps LEDStatus != 3 as source truth without inventing the numeric LED enumeration", () => {
  const plan = library.getAplCartCorePlan(2);
  assert.match(plan.producer, /GSV\(MODULE, \?, LedStatus, LEDStatus\)/);
  assert.match(plan.producer, /NEQ\(LEDStatus,3\)/);
  assert.match(JSON.stringify(plan.watchPoints), /does not decode what numeric value 3 means/i);
  assert.ok(plan.circuitTrace.deviceRows.some((row) => /1756-L61/.test(row.device)));
});

test("00003 and 00004 reuse one LS143 circuit but retain direct-state vs reset-state semantics", () => {
  const open = library.getAplCartCorePlan(3);
  const reset = library.getAplCartCorePlan(4);
  assert.match(open.producer, /XIC\(E2001_LS143_SafetySwitch/);
  assert.match(open.producer, /Faults\[0\]\.3/);
  assert.match(reset.producer, /XIO\(E2001_LS143_SafetySwitch\)/);
  assert.match(reset.producer, /Faults\[0\]\.3/);
  assert.match(reset.producer, /ResetGeneral/);
  for (const plan of [open, reset]) {
    assert.ok(plan.circuitTrace.deviceRows.some((row) => row.device === "LS143"));
    assert.ok(plan.circuitTrace.drawingLocations.some((row) => row.pdfPage === 47));
  }
});

test("00020 is a carriage-return/reset state built from P133 plus StoreCarriageNotFront", () => {
  const plan = library.getAplCartCorePlan(20);
  assert.match(plan.producer, /P133/);
  assert.match(plan.producer, /I0005\.27/);
  assert.match(plan.producer, /StoreCarriageNotFront/);
  assert.match(plan.producer, /Faults\[1\]\.4/);
  assert.ok(plan.circuitTrace.deviceRows.some((row) => row.device === "P133"));
  assert.ok(plan.circuitTrace.drawingLocations.some((row) => row.pdfPage === 46));
  const evaluation = library.evaluateAplCartCore(20, { p133: "1", stored: "1" });
  assert.equal(evaluation.severity, "direct");
  assert.match(evaluation.summary, /exact 00020 producer state/i);
});

test("00031 remains searchable but has no invented synchronization producer", () => {
  const entry = library.getEntry("apl-cart-00031");
  const plan = library.getAplCartCorePlan(31);
  assert.equal(plan.status, "catalog-only-no-executable-producer");
  assert.match(plan.producer, /No executable reference to Faults\[1\]\.15/i);
  assert.equal(plan.circuitTrace, null);
  assert.ok(plan.sourceGap);
  assert.match(entry.summary, /no executable producer/i);
  assert.match(JSON.stringify(plan.watchPoints), /do not borrow Fault 00016/i);
  assert.match(JSON.stringify(plan.watchPoints), /DataFromLS\.Par1\[0\]\.3/);
});

test("v364 extends the existing APL foundation UI API instead of creating a duplicate renderer", () => {
  assert.ok(library.getAplCartFoundationPlan(1));
  assert.ok(library.getAplCartFoundationPlan(20));
  assert.ok(library.getAplCartFoundationPlan(31));
  assert.ok(library.getAplCartFoundationPlan(5), "existing v355 plan must still delegate");
  const eval1 = library.evaluateAplCartFoundation(1, { cr202: "0", cr204: "1" });
  assert.equal(eval1.severity, "direct");
  assert.match(eval1.summary, /CR202\/I0005\.04/);
});

test("five-digit Cart-local codes stay distinct from same-number base Labeler faults", () => {
  const exact1 = library.searchEntries("00001", { machineType: "TopModul", applicationMode: "apl" }, 8);
  const exact20 = library.searchEntries("00020", { machineType: "TopModul", applicationMode: "apl" }, 8);
  const exact31 = library.searchEntries("00031", { machineType: "TopModul", applicationMode: "apl" }, 8);
  assert.equal(exact1[0].id, "apl-cart-00001");
  assert.equal(exact20[0].id, "apl-cart-00020");
  assert.equal(exact31[0].id, "apl-cart-00031");
});

test("v364 loader is after the v363 Cart tail and before exact-search/controller startup", () => {
  assert.match(page, /data-troubleshooting-version="v364"/);
  assert.match(page, /TROUBLESHOOTING v364/);
  const tailIndex = page.indexOf("apl-cart-tail-status.js");
  const coreIndex = page.indexOf("apl-cart-core-status.js");
  const bridgeIndex = page.indexOf("topmodul-live-00067-source-bridge.js");
  const exactIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  assert.ok(tailIndex >= 0 && coreIndex > tailIndex && bridgeIndex > coreIndex);
  assert.ok(exactIndex > bridgeIndex && appIndex > exactIndex);
  assert.match(page, /troubleshooting-bootstrap-v358-20260904/);
});
