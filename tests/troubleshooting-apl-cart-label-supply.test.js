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
const stationCause = require(path.join(root, "app/troubleshooting/topmodul-station-cause-model.js"))(transport);
const labelerCause = require(path.join(root, "app/troubleshooting/topmodul-labeler-cause-model.js"))(stationCause);
const circuit = require(path.join(root, "app/troubleshooting/topmodul-circuit-trace.js"))(labelerCause);
const stationPower = require(path.join(root, "app/troubleshooting/topmodul-station-power-circuit.js"))(circuit);
const stationEncoder = require(path.join(root, "app/troubleshooting/topmodul-station-encoder-circuit.js"))(stationPower);
const stationServo = require(path.join(root, "app/troubleshooting/topmodul-station-servo-circuit.js"))(stationEncoder);
const stationComms = require(path.join(root, "app/troubleshooting/topmodul-station-communication-circuit.js"))(stationServo);
const stationProcess = require(path.join(root, "app/troubleshooting/topmodul-station-process-trace.js"))(stationComms);
const stationFoundation = require(path.join(root, "app/troubleshooting/topmodul-station-foundation-circuit.js"))(stationProcess);
const aplFoundation = require(path.join(root, "app/troubleshooting/apl-cart-foundation.js"))(stationFoundation);
const web = require(path.join(root, "app/troubleshooting/apl-cart-web-handling.js"))(aplFoundation);
const servo = require(path.join(root, "app/troubleshooting/apl-cart-servo-status.js"))(web);
const tail = require(path.join(root, "app/troubleshooting/apl-cart-tail-status.js"))(servo);
const core = require(path.join(root, "app/troubleshooting/apl-cart-core-status.js"))(tail);
const warnings = require(path.join(root, "app/troubleshooting/apl-cart-warning-status.js"))(core);
const library = require(path.join(root, "app/troubleshooting/apl-cart-label-supply-chronology.js"))(warnings);

const page = fs.readFileSync(path.join(root, "app/troubleshooting/index.html"), "utf8");

test("v366 label-supply chronology validates on top of v365 without duplicating Station trees", () => {
  const validation = library.validate();
  assert.equal(validation.ok, true, validation.errors.join(" | "));
  assert.match(library.version, /apl-cart-label-supply-v366/);
  assert.deepEqual([...library.aplCartLabelSupplyLabelerFaults], [655, 656, 657, 658, 659, 660]);
  assert.equal(library.getAplCartLabelSupplyPlan(655).chronology.oneSharedStationMethod, true);
  assert.equal(library.getAplCartLabelSupplyPlan(660).chronology.oneSharedStationMethod, true);
});

test("W 0005 remains pre-fault evidence and now exposes the full Cart-to-Labeler handoff", () => {
  const plan = library.getAplCartLabelSupplyPlan("W 0005");
  assert.ok(plan.previousPlan, "v365 warning plan should remain underneath v366 chronology");
  assert.match(plan.producer, /StartupComplete/);
  assert.match(plan.producer, /SS631/);
  assert.match(plan.producer, /Faults\[1\]\.9/);
  assert.match(plan.producer, /DataFromLS\.Par1\[0\]\.1/);
  const composite = plan.watchPoints.find((row) => row.tag === "DataFromLS.Par1[0].1");
  assert.match(composite.relationship, /W 0005/);
  assert.match(composite.relationship, /Cart 00025/);
  assert.match(composite.relationship, /ForceAutochange/);
  assert.match(composite.relationship, /label-length autochange/i);
  assert.match(composite.relationship, /not-selected/i);
});

test("Cart 00025 keeps the existing PE631/PE632 source route and gains only chronology", () => {
  const plan = library.getAplCartLabelSupplyPlan("00025");
  assert.ok(plan.previousPlan, "existing v361 plan must be retained");
  const source = JSON.stringify(plan.previousPlan);
  assert.match(source, /PE631|InputDetectEndOfReel1/);
  assert.match(source, /PE632|InputDetectEndOfReel2/);
  assert.match(plan.summary, /authoritative local No Labels \/ End Of Reel/i);
  assert.match(plan.producer, /DataFromLS\.Par1\[0\]\.1/);
});

test("W 0012 stays a measurement warning while its autochange request is shown as one composite-handoff contributor", () => {
  const plan = library.getAplCartLabelSupplyPlan("W 0012");
  assert.ok(plan.previousPlan);
  assert.match(plan.previousPlan.producer, /CountLabelLengthBad/);
  assert.match(plan.producer, /WarnLabLengthForceAutochg/);
  assert.match(plan.summary, /keep the measurement cause separate from end-of-reel hardware/i);
  assert.match(JSON.stringify(plan.watchPoints), /Do not change measurement thresholds|Do not change.*recipe/i);
});

test("Labeler 655 and 660 use the same shared method with only station instance substitution", () => {
  const first = library.getAplCartLabelSupplyPlan(655);
  const last = library.getAplCartLabelSupplyPlan(660);
  assert.equal(first.chronology.station, 1);
  assert.equal(last.chronology.station, 6);
  assert.match(first.producer, /DataFromLS\[1\]\.Par1\[0\]\.1/);
  assert.match(first.producer, /Aggregat_01\.I_LackOfLabel/);
  assert.match(last.producer, /DataFromLS\[6\]\.Par1\[0\]\.1/);
  assert.match(last.producer, /Aggregat_06\.I_LackOfLabel/);
  assert.match(first.summary, /downstream.*summary/i);
  assert.match(last.summary, /downstream.*summary/i);
  assert.equal(first.steps.length, last.steps.length);
});

test("read-only chronology prioritizes local Cart evidence ahead of downstream Labeler summary", () => {
  const hard = library.evaluateAplCartLabelSupply(655, { cartEndOfReel: "yes", handoff: "yes", labelerSummary: "yes" });
  assert.equal(hard.severity, "direct");
  assert.match(hard.title, /Hard Cart end-of-reel/i);
  const warning = library.evaluateAplCartLabelSupply("W 0005", { lowLabels: "yes", autochange: "yes" });
  assert.equal(warning.severity, "direct");
  assert.match(warning.next, /suppression as recovery|suppression.*recovery/i);
  const downstream = library.evaluateAplCartLabelSupply(655, { handoff: "yes", labelerSummary: "yes" });
  assert.equal(downstream.severity, "hold");
  assert.match(downstream.summary, /composite bit alone/i);
});

test("existing APL source-isolation renderer can render v366 through getAplCartFoundationPlan", () => {
  assert.match(library.getAplCartFoundationPlan("W 0005").id, /label-supply-v366/);
  assert.match(library.getAplCartFoundationPlan("00025").id, /label-supply-v366/);
  assert.match(library.getAplCartFoundationPlan(655).id, /label-supply-v366/);
  assert.ok(library.getAplCartFoundationPlan("00028"), "unrelated Cart fault must still delegate to the existing plan");
});

test("v366 module is loaded after warnings and before search/controller startup", () => {
  const warningIndex = page.indexOf("apl-cart-warning-status.js");
  const chronologyIndex = page.indexOf("apl-cart-label-supply-chronology.js");
  const bridgeIndex = page.indexOf("topmodul-live-00067-source-bridge.js");
  const searchIndex = page.indexOf("troubleshooting-search-precedence.js");
  const appIndex = page.indexOf("troubleshooting-app.js");
  assert.ok(warningIndex >= 0 && chronologyIndex > warningIndex && bridgeIndex > chronologyIndex);
  assert.ok(searchIndex > bridgeIndex && appIndex > searchIndex);
  assert.match(page, /data-troubleshooting-version="v366"/);
  assert.match(page, /TROUBLESHOOTING v366/);
});