"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-message-v9.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Message_Test
  TAG
    ReadMsg : MESSAGE (MessageType := CIP Data Table Read,
                       RemoteElement := RemoteData,
                       RequestedLength := 10,
                       ConnectedFlag := 1,
                       ConnectionPath := "ENBT,2,192.168.1.20,1,0",
                       CommTypeCode := 0,
                       LocalElement := LocalReadData,
                       CacheConnections := TRUE);
    WriteMsg : MESSAGE (MessageType := CIP Data Table Write,
                        RemoteElement := RemoteDestination,
                        RequestedLength := 4,
                        ConnectionPath := "ENBT,2,192.168.1.30,1,0",
                        LocalElement := LocalWriteData);
    GenericMsg : MESSAGE (MessageType := CIP Generic,
                          RequestedLength := 2,
                          ConnectedFlag := 1,
                          ConnectionPath := "ENBT,2,192.168.1.40",
                          CommTypeCode := 0,
                          ServiceCode := 16#000E,
                          ObjectType := 16#0004,
                          TargetObject := 101,
                          AttributeNumber := 16#0003,
                          LocalElement := GenericBuffer,
                          DestinationTag := GenericResponse,
                          LargePacketUsage := FALSE);
    Trigger : BOOL;
    LocalReadData : DINT[10];
    LocalWriteData : DINT[4];
    GenericBuffer : DINT[2];
    GenericResponse : DINT;
    Faults : DINT[1];
  END_TAG

  MODULE ENBT
    Parent := Local;
    Slot := 1;
    CatalogNumber := "1756-ENBT/A";
  END_MODULE

  PROGRAM P (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(Trigger)MSG(ReadMsg);
      END_RUNG
      RUNG 1
        N: XIC(Trigger)MSG(WriteMsg);
      END_RUNG
      RUNG 2
        N: XIC(Trigger)MSG(GenericMsg);
      END_RUNG
      RUNG 3
        N: XIC(ReadMsg.ER)OTL(Faults[0].1);
      END_RUNG
    END_ROUTINE
  END_PROGRAM

  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;

function v9Findings(project) {
  return (project.findings || []).filter((finding) => finding.sourceRule === "plc-message-v9");
}

test("v9 parses L5K MESSAGE tag configuration including quoted connection paths", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "messages.L5K", byteLength: fixture.length });
  const topology = project.dependencies.messageTopology;
  assert.equal(topology.version, "v9");
  assert.equal(topology.statistics.messageTags, 3);
  const read = topology.messageTags.find((item) => item.name === "ReadMsg");
  assert.ok(read);
  assert.equal(read.messageType, "CIP Data Table Read");
  assert.equal(read.remoteElement, "RemoteData");
  assert.equal(read.localElement, "LocalReadData");
  assert.equal(read.requestedLength, "10");
  assert.equal(read.connectionPath, "ENBT,2,192.168.1.20,1,0");
  assert.equal(read.cacheConnections, "TRUE");
});

test("v9 preserves CIP Generic service/object configuration as source evidence", () => {
  const project = analyzer.parseL5K(fixture);
  const generic = project.dependencies.messageTopology.messageTags.find((item) => item.name === "GenericMsg");
  assert.ok(generic);
  assert.equal(generic.messageType, "CIP Generic");
  assert.equal(generic.serviceCode, "16#000E");
  assert.equal(generic.objectType, "16#0004");
  assert.equal(generic.targetObject, "101");
  assert.equal(generic.attributeNumber, "16#0003");
  assert.equal(generic.destinationTag, "GenericResponse");
  assert.equal(generic.largePacketUsage, "FALSE");
});

test("v9 indexes MSG call sites and resolves their MESSAGE control tags", () => {
  const project = analyzer.parseL5K(fixture);
  const topology = project.dependencies.messageTopology;
  assert.equal(topology.statistics.msgCalls, 3);
  assert.equal(topology.statistics.resolvedCalls, 3);
  const readCall = topology.calls.find((item) => item.controlTag === "ReadMsg");
  assert.ok(readCall);
  assert.equal(readCall.program, "P");
  assert.equal(readCall.routine, "Main");
  assert.equal(readCall.rung, 0);
  assert.equal(readCall.messageType, "CIP Data Table Read");
  assert.equal(readCall.direction, "inbound-read");
  assert.equal(readCall.taskRootReachable, true);
  assert.ok(readCall.pathModuleMatches.includes("ENBT"));
  assert.equal(readCall.runtimeExecutionProven, false);
});

test("v9 distinguishes read, write, and CIP Generic directions without claiming transaction success", () => {
  const project = analyzer.parseL5K(fixture);
  const calls = project.dependencies.messageTopology.calls;
  assert.equal(calls.find((item) => item.controlTag === "ReadMsg").direction, "inbound-read");
  assert.equal(calls.find((item) => item.controlTag === "WriteMsg").direction, "outbound-write");
  assert.equal(calls.find((item) => item.controlTag === "GenericMsg").direction, "cip-generic");
  assert.match(project.dependencies.messageTopology.sourceBoundary, /does not prove rung execution/i);
  assert.match(project.dependencies.messageTopology.sourceBoundary, /message completion/i);
  assert.match(project.dependencies.messageTopology.sourceBoundary, /payload freshness/i);
});

test("v9 traces MESSAGE status references back to static message configuration without proving EN/DN/ER state", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "Faults[0].1", { maxDepth: 6 });
  assert.equal(trace.messageRuntimeStateProven, false);
  const context = trace.messageContexts.find((item) => item.controlTag === "ReadMsg");
  assert.ok(context);
  assert.equal(context.messageType, "CIP Data Table Read");
  assert.equal(context.remoteElement, "RemoteData");
  assert.equal(context.localElement, "LocalReadData");
  assert.match(trace.messageNote, /EN\/DN\/ER state/i);
  assert.match(trace.messageNote, /not proven/i);
});

test("v9 reports an unresolved MSG control tag as source review rather than a live communications fault", () => {
  const text = fixture.replace("MSG(ReadMsg)", "MSG(MissingMessageControl)");
  const project = analyzer.parseL5K(text);
  const finding = v9Findings(project).find((item) => item.id === "v9:msg-control-unresolved:P:Main:0");
  assert.ok(finding);
  assert.equal(finding.classification, "source-proven");
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /verify project\/export completeness and scope/i);
  assert.match(finding.summary, /does not prove a live communications fault/i);
});

test("v9 marks an unconfigured MESSAGE tag as review evidence only", () => {
  const text = fixture.replace("    Trigger : BOOL;", "    SpareMessage : MESSAGE;\n    Trigger : BOOL;");
  const project = analyzer.parseL5K(text);
  const finding = v9Findings(project).find((item) => item.id === "v9:message-unconfigured:controller:SpareMessage");
  assert.ok(finding);
  assert.equal(finding.severity, "review");
  assert.match(finding.summary, /may be intentional during commissioning or dynamic configuration/i);
});

test("v9 resolves program-scoped MESSAGE configuration before same-name controller scope", () => {
  const text = `RSLogix 5000 Export Version 20.01
CONTROLLER Scoped_Message
  TAG
    SharedMsg : MESSAGE (MessageType := CIP Data Table Read, RemoteElement := ControllerRemote, RequestedLength := 1, ConnectionPath := "ControllerPath", LocalElement := ControllerLocal);
    Trigger : BOOL;
    ControllerLocal : DINT;
  END_TAG
  PROGRAM P (MAIN := Main)
    TAG
      SharedMsg : MESSAGE (MessageType := CIP Data Table Write, RemoteElement := ProgramRemote, RequestedLength := 1, ConnectionPath := "ProgramPath", LocalElement := ProgramLocal);
      ProgramLocal : DINT;
    END_TAG
    ROUTINE Main
      RUNG 0
        N: XIC(Trigger)MSG(SharedMsg);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
  TASK MainTask (Type := CONTINUOUS, Priority := 10)
    P;
  END_TASK
END_CONTROLLER`;
  const project = analyzer.parseL5K(text);
  const call = project.dependencies.messageTopology.calls[0];
  assert.equal(call.configurationScope, "P");
  assert.equal(call.messageType, "CIP Data Table Write");
  assert.equal(call.remoteElement, "ProgramRemote");
  assert.equal(call.connectionPath, "ProgramPath");
});

test("v9 search indexes MESSAGE configuration and MSG call evidence through openable findings", () => {
  const project = analyzer.parseL5K(fixture);
  const pathResults = analyzer.searchAnalysis(project, "192.168.1.20", 20);
  assert.ok(pathResults.some((item) => item.type === "finding" && item.title.includes("ReadMsg")));
  const msgResults = analyzer.searchAnalysis(project, "GenericMsg", 20);
  assert.ok(msgResults.some((item) => item.type === "finding" && /GenericMsg/.test(item.title)));
});

test("v9 preserves v8 produced/consumed and v7 task topology", () => {
  const text = fixture.replace("    Trigger : BOOL;", "    ConsumedData : DINT (Producer := PeerController, RemoteTag := RemoteProducedData, RPI := 20);\n    Trigger : BOOL;");
  const project = analyzer.parseL5K(text);
  assert.equal(project.dependencies.taskScheduling.version, "v7");
  assert.equal(project.dependencies.communicationTopology.version, "v8");
  assert.equal(project.dependencies.messageTopology.version, "v9");
  assert.ok(project.dependencies.communicationTopology.consumed.some((item) => item.name === "ConsumedData"));
});

test("v9 page and worker remain browser-local/read-only and load after v8", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-message-v9.js"), "utf8");
  assert.match(page, /PLC ANALYZER v9 — MSG MESSAGE TOPOLOGY/);
  assert.match(page, /l5k-analyzer-communication-v8\.js\?v=8/);
  assert.match(page, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(worker, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(page, /route health, packet delivery, message completion/i);
  assert.match(page, /EN\/DN\/ER state/i);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(page, /connect to PLC|write to PLC|force PLC/i);
});
