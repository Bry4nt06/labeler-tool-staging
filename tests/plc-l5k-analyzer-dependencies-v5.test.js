"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5k-analyzer-dependencies-v5.js"));

const fixture = `RSLogix 5000 Export Version 20.01
CONTROLLER Dependency_Test
  DATATYPE DeviceState (FamilyType := NoFamily)
    BOOL Ready;
    DINT Count;
  END_DATATYPE

  ADD_ON_INSTRUCTION_DEFINITION DemoAOI
    PARAMETERS
      Enable : BOOL (Usage := Input);
      Status : BOOL (Usage := Output);
    END_PARAMETERS
    LOCAL_TAGS
      Internal : BOOL;
    END_LOCAL_TAGS
  END_ADD_ON_INSTRUCTION_DEFINITION

  TAG
    Device : DeviceState;
    DemoInst : DemoAOI;
    InputA : BOOL;
    Intermediate : BOOL;
    A : BOOL;
    B : BOOL;
    Faults : DINT[2];
  END_TAG

  PROGRAM MainProgram (MAIN := MainRoutine,
                       MODE := 0)
    ROUTINE MainRoutine
      RUNG 0
        N: JSR(FaultRoutine);
      END_RUNG
    END_ROUTINE

    ROUTINE FaultRoutine
      RUNG 0
        N: XIC(InputA)OTE(Intermediate);
      END_RUNG
      RUNG 1
        N: XIC(Intermediate)XIC(Device.Ready)DemoAOI(DemoInst,InputA)XIC(DemoInst.Status)OTL(Faults[0].1);
      END_RUNG
      RUNG 2
        N: XIC(B)OTE(A);
      END_RUNG
      RUNG 3
        N: XIC(A)OTE(B);
      END_RUNG
      RUNG 4
        N: XIC(A)OTL(Faults[0].2);
      END_RUNG
    END_ROUTINE
  END_PROGRAM
END_CONTROLLER
`;

test("v5 parses UDT definitions and scoped tag types", () => {
  const project = analyzer.parseL5K(fixture, { fileName: "dependency.L5K", byteLength: fixture.length });
  assert.equal(project.dependencies.version, "v5");
  assert.equal(project.dependencies.dataTypes.length, 1);
  assert.equal(project.dependencies.dataTypes[0].name, "DeviceState");
  assert.deepEqual(project.dependencies.dataTypes[0].members.map((member) => [member.name, member.dataType]), [["Ready", "BOOL"], ["Count", "DINT"]]);
  const device = project.dependencies.scopedTags.find((tag) => tag.name === "Device");
  assert.ok(device);
  assert.equal(device.dataType, "DeviceState");
  assert.equal(device.scope, "controller");
});

test("v5 builds JSR call graph and recognizes program MAIN routine", () => {
  const project = analyzer.parseL5K(fixture);
  assert.equal(project.dependencies.programMainRoutines.find((item) => item.program === "MainProgram")?.mainRoutine, "MainRoutine");
  const call = project.dependencies.routineCalls.find((item) => item.calleeRoutine === "FaultRoutine");
  assert.ok(call);
  assert.equal(call.program, "MainProgram");
  assert.equal(call.callerRoutine, "MainRoutine");
  assert.equal(call.rung, 0);
});

test("v5 indexes AOI definitions and AOI invocation instances without claiming runtime state", () => {
  const project = analyzer.parseL5K(fixture);
  const definition = project.dependencies.aoiDefinitions.find((item) => item.name === "DemoAOI");
  assert.ok(definition);
  assert.deepEqual(definition.parameters.map((item) => [item.name, item.dataType, item.usage]), [["Enable", "BOOL", "Input"], ["Status", "BOOL", "Output"]]);
  const call = project.dependencies.aoiCalls.find((item) => item.definition === "DemoAOI");
  assert.ok(call);
  assert.equal(call.instanceTag, "DemoInst");
  assert.equal(call.routine, "FaultRoutine");
});

test("v5 traces a fault through intermediate writers, UDT members, AOI members, and JSR execution path", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "Faults[0].1", { maxDepth: 6 });
  assert.equal(trace.runtimeStateProven, false);
  assert.equal(trace.classification, "static-inference");
  assert.ok(trace.nodes.some((node) => node.symbol === "Intermediate" && node.depth === 1));
  assert.ok(trace.nodes.some((node) => node.symbol === "InputA" && node.depth >= 1));

  const udt = trace.nodes.find((node) => node.symbol === "Device.Ready");
  assert.ok(udt);
  assert.equal(udt.kind, "udt-member");
  assert.equal(udt.dataTypeDefinition, "DeviceState");
  assert.equal(udt.memberDataType, "BOOL");

  const aoi = trace.nodes.find((node) => node.symbol === "DemoInst.Status");
  assert.ok(aoi);
  assert.equal(aoi.kind, "aoi-member");
  assert.equal(aoi.aoiDefinition, "DemoAOI");
  assert.ok(trace.aoiContexts.some((context) => context.instanceTag === "DemoInst" && context.calls.length === 1));

  const paths = trace.executionPaths.flatMap((group) => group.paths || []);
  assert.ok(paths.some((path) => path.some((step) => step.routine === "MainRoutine" && step.root)));
  assert.ok(paths.some((path) => path.some((step) => step.routine === "FaultRoutine")));
});

test("v5 trace is cycle-safe for mutually dependent intermediate tags", () => {
  const project = analyzer.parseL5K(fixture);
  const trace = analyzer.traceTarget(project, "Faults[0].2", { maxDepth: 10, maxNodes: 100 });
  assert.equal(trace.truncated, false);
  assert.ok(trace.nodes.some((node) => node.symbol === "A"));
  assert.ok(trace.nodes.some((node) => node.symbol === "B"));
  assert.ok(trace.nodes.some((node) => node.cycle === true));
  assert.ok(trace.nodes.length < 20);
});

test("v5 enriches the legacy v4 parser path without losing routine context", () => {
  const legacy = `Version := RSLogix 5000 v15.02\nCONTROLLER Legacy\nDATATYPE State\nBOOL Ready;\nEND_DATATYPE\nTAG\nInputA : BOOL;\nFaults : DINT[1];\nEND_TAG\nPROGRAM P (MAIN := Main)\nROUTINE Main\nN: JSR(FaultsRoutine);\nEND_ROUTINE\nROUTINE FaultsRoutine\nN: XIC(InputA)OTL(Faults[0].1);\nEND_ROUTINE\nEND_PROGRAM\nEND_CONTROLLER`;
  const project = analyzer.parseL5K(legacy);
  assert.equal(project.exportVersion, "15.02");
  assert.equal(project.source.ladderEncoding, "legacy-neutral-N");
  assert.equal(project.statistics.rungs, 2);
  assert.equal(project.dependencies.routineCalls[0].callerRoutine, "Main");
  assert.equal(project.dependencies.routineCalls[0].calleeRoutine, "FaultsRoutine");
  assert.equal(project.faultWriters[0].writers[0].routine, "FaultsRoutine");
});

test("v5 dependency UI remains local/read-only under the current analyzer release", () => {
  const fs = require("node:fs");
  const ui = fs.readFileSync(path.join(root, "app/plc-analyzer/plc-analyzer-dependencies-v5.js"), "utf8");
  const page = fs.readFileSync(path.join(root, "app/plc-analyzer/index.html"), "utf8");
  assert.match(ui, /new Worker\("\.\/l5k-analyzer-worker\.js\?v=5"\)/);
  assert.match(ui, /Static source trace/);
  assert.match(page, /PLC ANALYZER v8 — PRODUCED \/ CONSUMED TOPOLOGY/);
  assert.match(page, /l5k-analyzer-dependencies-v5\.js\?v=5/);
  assert.match(page, /plc-analyzer-dependencies-v5\.js\?v=8/);
  assert.doesNotMatch(ui, /fetch\s*\(/);
  assert.doesNotMatch(ui, /XMLHttpRequest/);
  assert.doesNotMatch(ui, /localStorage/);
  assert.doesNotMatch(ui, /indexedDB/);
});
