"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-communication-v8.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Communication_Test
  TAG
    ProducedData : DINT (ProduceCount := 2,
                         MinimumRPI := 2.0,
                         MaximumRPI := 100.0,
                         DefaultRPI := 10.0);
    ConsumedData : DINT (Producer := RemoteController,
                         RemoteTag := RemoteProducedData,
                         RPI := 20);
    LegacyConsumed : DINT (Producer := RemoteController,
                            RemoteFile := 5,
                            RPI := 10,
                            IncludeConnectionStatus := Yes,
                            TimeoutMultiplier := 2);
    InputA : BOOL;
    Faults : DINT[2];
  END_TAG

  MODULE RemoteController
    Parent := Local;
    Slot := 3;
    CatalogNumber := "1756-ENBT/A";
  END_MODULE

  PROGRAM P (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(ConsumedData.0)OTL(Faults[0].1);
      END_RUNG
      RUNG 1
        N: XIC(InputA)OTE(ProducedData.0);
      END_RUNG
    END_ROUTINE
  END_PROGRAM

  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;

function v8Findings(project) {
  return (project.findings || []).filter((finding) => finding.sourceRule === "plc-communication-v8");
}

test("v8 parses multiline produced and consumed L5K tag attributes", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "communication.L5K", byteLength: fixture.length });
  const topology = project.dependencies.communicationTopology;
  assert.equal(topology.version, "v8");
  assert.equal(topology.statistics.producedTags, 1);
  assert.equal(topology.statistics.consumedTags, 2);

  const produced = topology.produced.find((tag) => tag.name === "ProducedData");
  assert.ok(produced);
  assert.equal(produced.produced.produceCount, "2");
  assert.equal(produced.produced.minimumRPI, "2.0");
  assert.equal(produced.produced.maximumRPI, "100.0");
  assert.equal(produced.produced.defaultRPI, "10.0");

  const consumed = topology.consumed.find((tag) => tag.name === "ConsumedData");
  assert.ok(consumed);
  assert.equal(consumed.consumed.producer, "RemoteController");
  assert.equal(consumed.consumed.remoteTag, "RemoteProducedData");
  assert.equal(consumed.consumed.rpi, "20");

  const legacy = topology.consumed.find((tag) => tag.name === "LegacyConsumed");
  assert.ok(legacy);
  assert.equal(legacy.consumed.remoteFile, "5");
  assert.equal(legacy.consumed.includeConnectionStatus, "Yes");
  assert.equal(legacy.consumed.timeoutMultiplier, "2");
});

test("v8 builds inbound and outbound source topology without claiming runtime connection", () => {
  const project = analyzer.parseL5K(fixture);
  const topology = project.dependencies.communicationTopology;
  const inbound = topology.inbound.find((edge) => edge.localTag === "ConsumedData");
  assert.ok(inbound);
  assert.equal(inbound.producer, "RemoteController");
  assert.equal(inbound.remoteTag, "RemoteProducedData");
  assert.equal(inbound.producerModulePresent, true);

  const outbound = topology.outbound.find((edge) => edge.localTag === "ProducedData");
  assert.ok(outbound);
  assert.equal(outbound.produceCount, "2");
  assert.equal(outbound.actualConsumersProven, false);
  assert.match(topology.sourceBoundary, /do not prove peer availability/i);
  assert.match(topology.sourceBoundary, /actual consumer count/i);
});

test("v8 emits source-proven informational records for valid produced and consumed mappings", () => {
  const project = analyzer.parseL5K(fixture);
  const findings = v8Findings(project);
  const consumed = findings.find((finding) => finding.id === "v8:consumed-tag:controller:ConsumedData");
  const produced = findings.find((finding) => finding.id === "v8:produced-tag:controller:ProducedData");
  assert.ok(consumed);
  assert.ok(produced);
  assert.equal(consumed.classification, "source-proven");
  assert.equal(consumed.severity, "info");
  assert.match(consumed.summary, /not that the producer is online or data is arriving/i);
  assert.match(produced.summary, /do not identify actual connected consumers/i);
});

test("v8 reports incomplete consumed mapping without calling it a network fault", () => {
  const text = fixture.replace(
    "    InputA : BOOL;",
    "    BrokenConsumed : DINT (Producer := MissingPeer, RPI := 25);\n    InputA : BOOL;"
  );
  const project = analyzer.parseL5K(text);
  const finding = v8Findings(project).find((item) => item.id === "v8:consumed-required-attributes:controller:BrokenConsumed");
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /verify project revision\/export completeness/i);
  assert.doesNotMatch(finding.summary, /network fault/i);
});

test("v8 reports unresolved producer module only as static inference", () => {
  const text = fixture.replaceAll("RemoteController", "RemoteControllerNotInModules").replace("MODULE RemoteControllerNotInModules", "MODULE DifferentModule");
  const project = analyzer.parseL5K(text);
  const finding = v8Findings(project).find((item) => item.id === "v8:producer-module-unresolved:controller:ConsumedData");
  assert.ok(finding);
  assert.equal(finding.classification, "static-inference");
  assert.equal(finding.severity, "info");
  assert.match(finding.summary, /does not prove a network fault/i);
});

test("v8 flags source-visible produced RPI range inconsistencies without recommending values", () => {
  const text = fixture.replace("MinimumRPI := 2.0", "MinimumRPI := 200.0").replace("DefaultRPI := 10.0", "DefaultRPI := 150.0");
  const project = analyzer.parseL5K(text);
  const findings = v8Findings(project);
  const range = findings.find((item) => item.id === "v8:produced-rpi-range:controller:ProducedData");
  const defaultRange = findings.find((item) => item.id === "v8:produced-default-rpi-outside-range:controller:ProducedData");
  assert.ok(range);
  assert.ok(defaultRange);
  assert.match(range.summary, /do not change values without the approved machine\/project basis/i);
  assert.match(defaultRange.summary, /does not recommend a replacement RPI/i);
});

test("v8 flags mixed produced and consumed attribute families for revision review", () => {
  const text = fixture.replace(
    "    InputA : BOOL;",
    "    MixedTag : DINT (ProduceCount := 2, Producer := RemoteController, RemoteTag := RemoteProducedData, RPI := 20);\n    InputA : BOOL;"
  );
  const project = analyzer.parseL5K(text);
  const tag = project.dependencies.communicationTopology.tags.find((item) => item.name === "MixedTag");
  assert.ok(tag);
  assert.equal(tag.mixedRoleAttributes, true);
  const finding = v8Findings(project).find((item) => item.id === "v8:mixed-communication-attributes:controller:MixedTag");
  assert.ok(finding);
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /verify the exact export and Logix revision/i);
});

test("v8 dependency trace carries consumed-tag context without proving communication state", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "Faults[0].1", { maxDepth: 5 });
  assert.equal(trace.runtimeStateProven, false);
  assert.equal(trace.communicationStateProven, false);
  const context = trace.communicationContexts.find((item) => item.tag === "ConsumedData");
  assert.ok(context);
  assert.equal(context.role, "consumed");
  assert.equal(context.consumed.producer, "RemoteController");
  assert.equal(context.runtimeConnectionProven, false);
  assert.match(trace.note, /does not prove peer availability, packet delivery, or current connection status/i);
});

test("v8 search indexes produced and consumed communication metadata", () => {
  const project = analyzer.parseL5K(fixture);
  const producerResults = analyzer.searchAnalysis(project, "RemoteController", 20);
  assert.ok(producerResults.some((item) => item.type === "communication-tag" && item.title.includes("ConsumedData")));
  const producedResults = analyzer.searchAnalysis(project, "ProduceCount", 20);
  assert.ok(producedResults.some((item) => item.type === "communication-tag" && item.title.includes("ProducedData")));
});

test("v8 preserves v7 task topology and legacy neutral-N source support", () => {
  const legacy = `Version := RSLogix 5000 v15.02\nCONTROLLER LegacyCommunication\nTAG\nConsumedLegacy : DINT (Producer := PeerController, RemoteTag := RemoteData, RPI := 10, IncludeConnectionStatus := Yes);\nFaults : DINT[1];\nEND_TAG\nPROGRAM P (MAIN := Main)\nROUTINE Main\nN: XIC(ConsumedLegacy.0)OTL(Faults[0].1);\nEND_ROUTINE\nEND_PROGRAM\nTASK MainTask (Type := Continuous, Priority := 10)\nP;\nEND_TASK\nEND_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.dependencies.taskScheduling.version, "v7");
  assert.equal(project.dependencies.communicationTopology.version, "v8");
  assert.equal(project.dependencies.communicationTopology.consumed[0].consumed.includeConnectionStatus, "Yes");
});

test("v8 page and worker remain browser-local/read-only", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-communication-v8.js"), "utf8");
  assert.match(page, /PLC ANALYZER v8 — PRODUCED \/ CONSUMED TOPOLOGY/);
  assert.match(page, /l5k-analyzer-task-schedule-v7\.js\?v=7/);
  assert.match(page, /l5k-analyzer-communication-v8\.js\?v=8/);
  assert.match(worker, /l5k-analyzer-communication-v8\.js\?v=8/);
  assert.match(page, /do not prove live execution/i);
  assert.match(page, /peer availability, packet delivery, current connection status/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(page, /connect to PLC|write to PLC|force PLC/i);
});
