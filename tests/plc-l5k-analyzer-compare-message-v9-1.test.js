"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-message-v9.js"));
const compare = require(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-message-v9-1.js"));

function fixture(options = {}) {
  const pathValue = options.pathValue || "1,3,2,192.168.1.10";
  const remoteElement = options.remoteElement || "RemoteData";
  const localElement = options.localElement || "LocalData";
  const requestedLength = options.requestedLength || "4";
  const serviceCode = options.serviceCode || "16#0E";
  const objectType = options.objectType || "16#93";
  const targetObject = options.targetObject || "1";
  const attributeNumber = options.attributeNumber || "3";
  const callControl = options.callControl || "MsgRead";
  const includeExtra = Boolean(options.includeExtra);
  const scheduleProgram = options.scheduleProgram !== false;
  const messageType = options.messageType || "CIP Data Table Read";
  const extra = includeExtra
    ? `    MsgExtra : MESSAGE (MessageType := CIP Data Table Write, RemoteElement := ExtraRemote, RequestedLength := 8, ConnectionPath := "1,3,2,192.168.1.20", LocalElement := ExtraLocal);\n`
    : "";
  return `RSLogix 5000 Export Version 20.01
CONTROLLER Compare_Message
  TAG
    MsgRead : MESSAGE (MessageType := ${messageType}, RemoteElement := ${remoteElement}, RequestedLength := ${requestedLength}, ConnectionPath := "${pathValue}", LocalElement := ${localElement}, CacheConnections := Yes);
    MsgWrite : MESSAGE (MessageType := CIP Data Table Write, RemoteElement := WriteRemote, RequestedLength := 4, ConnectionPath := "1,3,2,192.168.1.11", LocalElement := WriteLocal);
    MsgGeneric : MESSAGE (MessageType := CIP Generic, ServiceCode := ${serviceCode}, ObjectType := ${objectType}, TargetObject := ${targetObject}, AttributeNumber := ${attributeNumber}, ConnectionPath := "1,3,2,192.168.1.12");
${extra}    LocalData : DINT[4];
    WriteLocal : DINT[4];
    ExtraLocal : DINT[8];
  END_TAG

  PROGRAM P (MAIN := Main)
    ROUTINE Main
      RUNG 0
        N: XIC(LocalData[0].0)MSG(${callControl});
      END_RUNG
    END_ROUTINE
  END_PROGRAM

  TASK MainTask (Type := CONTINUOUS, Priority := 10)
${scheduleProgram ? "    P;\n" : ""}  END_TASK
END_CONTROLLER`;
}

function messageDiffs(result) {
  return (result.differences || []).filter((item) => item.category === "messages");
}

test("v9.1 reports no MSG/MESSAGE differences for identical exports", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture());
  const result = compare.compareProjects(baseline, current);
  assert.equal(result.version, "l5k-compare-v9.1");
  assert.equal(result.statistics.messageDifferences, 0);
  assert.equal(messageDiffs(result).length, 0);
});

test("v9.1 detects MESSAGE path, elements, and requested-length changes as offline source evidence", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ pathValue: "1,4,2,192.168.1.30", remoteElement: "ReplacementRemote", localElement: "ReplacementLocal", requestedLength: "12" }));
  const result = compare.compareProjects(baseline, current);
  const changed = messageDiffs(result).find((item) => item.messageKind === "message-config" && /MsgRead/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.changeType, "changed");
  assert.equal(changed.baseline.connectionPath, "1,3,2,192.168.1.10");
  assert.equal(changed.current.connectionPath, "1,4,2,192.168.1.30");
  assert.equal(changed.current.remoteElement, "ReplacementRemote");
  assert.equal(changed.current.localElement, "ReplacementLocal");
  assert.equal(changed.current.requestedLength, "12");
  assert.match(changed.summary, /not adjustment recommendations/i);
});

test("v9.1 detects CIP Generic service/object configuration changes", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ serviceCode: "16#10", objectType: "16#94", targetObject: "2", attributeNumber: "5" }));
  const result = compare.compareProjects(baseline, current);
  const changed = messageDiffs(result).find((item) => item.messageKind === "message-config" && /MsgGeneric/.test(item.title));
  assert.ok(changed);
  assert.equal(changed.baseline.serviceCode, "16#0E");
  assert.equal(changed.current.serviceCode, "16#10");
  assert.equal(changed.current.objectType, "16#94");
  assert.equal(changed.current.targetObject, "2");
  assert.equal(changed.current.attributeNumber, "5");
});

test("v9.1 detects MESSAGE configuration additions/removals", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ includeExtra: true }));
  const result = compare.compareProjects(baseline, current);
  const added = messageDiffs(result).find((item) => item.messageKind === "message-config" && item.changeType === "added" && /MsgExtra/.test(item.title));
  assert.ok(added);
  assert.match(added.summary, /does not prove that a MSG executes/i);
});

test("v9.1 detects a changed MSG control tag at the same source call site", () => {
  const baseline = analyzer.parseL5K(fixture({ callControl: "MsgRead" }));
  const current = analyzer.parseL5K(fixture({ callControl: "MsgWrite" }));
  const result = compare.compareProjects(baseline, current);
  const changed = messageDiffs(result).find((item) => item.messageKind === "msg-call-site" && item.changeType === "changed");
  assert.ok(changed);
  assert.equal(changed.baseline[0].controlTag, "MsgRead");
  assert.equal(changed.current[0].controlTag, "MsgWrite");
  assert.match(changed.summary, /does not prove current execution/i);
});

test("v9.1 carries task-root reachability changes into MSG call-site comparison without claiming execution", () => {
  const baseline = analyzer.parseL5K(fixture({ scheduleProgram: true }));
  const current = analyzer.parseL5K(fixture({ scheduleProgram: false }));
  const result = compare.compareProjects(baseline, current);
  const changed = messageDiffs(result).find((item) => item.messageKind === "msg-call-site" && item.changeType === "changed");
  assert.ok(changed);
  assert.equal(changed.baseline[0].taskRootReachable, true);
  assert.equal(changed.current[0].taskRootReachable, false);
  assert.match(result.messageComparison.sourceBoundary, /does not prove rung execution/i);
  assert.match(result.messageComparison.sourceBoundary, /current EN\/DN\/ER state/i);
});

test("v9.1 message category works with the existing comparison filter API", () => {
  const baseline = analyzer.parseL5K(fixture());
  const current = analyzer.parseL5K(fixture({ pathValue: "1,4,2,192.168.1.30", callControl: "MsgWrite" }));
  const result = compare.compareProjects(baseline, current);
  const filtered = compare.filterDifferences(result, { category: "messages" });
  assert.ok(filtered.length >= 2);
  assert.ok(filtered.every((item) => item.category === "messages"));
});

test("v9.1 Compare layer remains local/read-only under the current v10.1 consistency-aware release", () => {
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/compare.html"), "utf8");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-compare-v5-2.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-worker.js"), "utf8");
  const engine = fs.readFileSync(path.join(root, "app/plc-analyzer/l5k-analyzer-compare-message-v9-1.js"), "utf8");
  const analyzerV9 = page.indexOf("l5k-analyzer-message-v9.js?v=9");
  const analyzerV10 = page.indexOf("l5k-analyzer-consistency-v10.js?v=10");
  const communicationCompare = page.indexOf("l5k-analyzer-compare-communication-v8-1.js?v=8.1");
  const messageCompare = page.indexOf("l5k-analyzer-compare-message-v9-1.js?v=9.1");
  const consistencyCompare = page.indexOf("l5k-analyzer-compare-consistency-v10-1.js?v=10.1");
  const uiScript = page.indexOf("plc-analyzer-compare-v5-2.js?v=10.1");
  assert.ok(analyzerV9 >= 0 && analyzerV9 < analyzerV10 && analyzerV10 < communicationCompare && communicationCompare < messageCompare && messageCompare < consistencyCompare && consistencyCompare < uiScript);
  assert.match(page, /PLC ANALYZER COMPARE v9\.1 — MSG \/ MESSAGE DIFF .* v10\.1 CONSISTENCY STATE DIFF/);
  assert.match(page, /value="messages"/);
  assert.match(page, /message completion, current EN\/DN\/ER state/i);
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-compare-worker\.js\?v=10\.1"\)/);
  assert.match(ui, /item\.messageKind/);
  assert.match(worker, /l5k-analyzer-message-v9\.js\?v=9/);
  assert.match(worker, /l5k-analyzer-consistency-v10\.js\?v=10/);
  assert.match(worker, /l5k-analyzer-compare-message-v9-1\.js\?v=9\.1/);
  assert.match(worker, /l5k-analyzer-compare-consistency-v10-1\.js\?v=10\.1/);
  assert.doesNotMatch(engine, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
  assert.doesNotMatch(ui, /fetch\s*\(|XMLHttpRequest|localStorage|indexedDB/i);
});
