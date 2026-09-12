"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const analyzer = require(path.join(root, "app/plc-analyzer/l5x-source-provenance-v15.js"));

const l5x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<RSLogix5000Content SchemaRevision="1.0" SoftwareRevision="35.00" TargetName="Example_Labeler" TargetType="Controller" ContainsContext="true" ExportDate="Sat Sep 06 17:10:00 2026">
  <Controller Name="Example_Labeler" ProcessorType="1756-L81E">
    <DataTypes>
      <DataType Name="ExampleUDT" Family="NoFamily" Class="User">
        <Members>
          <Member Name="State" DataType="DINT" Dimension="0" Radix="Decimal" Hidden="false" ExternalAccess="Read/Write"/>
        </Members>
      </DataType>
    </DataTypes>
    <Modules>
      <Module Name="RemotePLC" CatalogNumber="1756-EN2T" Slot="4" ParentModule="Local">
        <Ports><Port Id="1" Address="10.10.10.20" Type="Ethernet"/></Ports>
      </Module>
    </Modules>
    <Tags>
      <Tag Name="GuardClosed" TagType="Alias" DataType="BOOL" AliasFor="Local:1:I.Data.0"/>
      <Tag Name="StartPermissive" TagType="Base" DataType="BOOL"/>
      <Tag Name="ResetPB" TagType="Base" DataType="BOOL"/>
      <Tag Name="PublishedState" TagType="Produced" DataType="DINT"><ProduceInfo ProduceCount="1" MinimumRPI="10" MaximumRPI="1000"/></Tag>
      <Tag Name="RemoteState" TagType="Consumed" DataType="DINT"><ConsumeInfo Producer="RemotePLC" RemoteTag="PublishedState" RPI="20"/></Tag>
      <Tag Name="MsgRead" TagType="Base" DataType="MESSAGE">
        <Data Format="Decorated"><Structure DataType="MESSAGE">
          <DataValueMember Name="MessageType" DataType="DINT" Radix="Decimal" Value="CIP Data Table Read"/>
          <DataValueMember Name="RemoteElement" DataType="STRING" Value="PublishedState"/>
          <DataValueMember Name="ConnectionPath" DataType="STRING" Value="RemotePLC"/>
        </Structure></Data>
      </Tag>
    </Tags>
    <Tasks>
      <Task Name="MainTask" Type="CONTINUOUS" Priority="10" Watchdog="500" InhibitTask="false">
        <ScheduledPrograms><ScheduledProgram Name="FaultProgram"/></ScheduledPrograms>
      </Task>
    </Tasks>
    <Programs>
      <Program Name="FaultProgram" MainRoutineName="MainRoutine">
        <Tags><Tag Name="LocalState" TagType="Base" DataType="DINT"/></Tags>
        <Routines>
          <Routine Name="MainRoutine" Type="RLL">
            <RLLContent>
              <Rung Number="0" Type="N"><Text><![CDATA[XIC(GuardClosed)XIC(StartPermissive)OTL(Faults[1].3);]]></Text></Rung>
              <Rung Number="1" Type="N"><Text><![CDATA[XIC(ResetPB)OTU(Faults[1].3);]]></Text></Rung>
              <Rung Number="2" Type="N"><Text><![CDATA[AFI()XIC(StartPermissive)OTE(Faults[2].1);]]></Text></Rung>
              <Rung Number="3" Type="N"><Text><![CDATA[MSG(MsgRead);]]></Text></Rung>
            </RLLContent>
          </Routine>
          <Routine Name="StructuredTextRoutine" Type="ST"><STContent><Line Number="0"><Text><![CDATA[LocalState := 1;]]></Text></Line></STContent></Routine>
        </Routines>
      </Program>
    </Programs>
  </Controller>
</RSLogix5000Content>`;

function lineContaining(text, needle) {
  return text.split("\n").findIndex((line) => line.includes(needle)) + 1;
}

test("v15 detects and parses full-project L5X through the existing analyzer chain", () => {
  assert.equal(analyzer.detectSourceFormat(l5x, { fileName: "example.L5X" }), "L5X");
  const project = analyzer.parseControllerSource(l5x, { fileName: "example.L5X", byteLength: l5x.length });
  assert.equal(project.controller, "Example_Labeler");
  assert.equal(project.exportVersion, "35.00");
  assert.equal(project.source.sourceFormat, "L5X");
  assert.equal(project.source.schemaRevision, "1.0");
  assert.equal(project.source.softwareRevision, "35.00");
  assert.equal(project.source.l5xAdapterVersion, "v15");
  assert.equal(project.source.provenanceVersion, "v15");
  assert.equal(project.source.provenanceMode, "l5x-program-routine-rung-text");
  assert.equal(project.statistics.programs, 1);
  assert.equal(project.statistics.routines, 1);
  assert.equal(project.statistics.rungs, 4);
  assert.equal(project.statistics.unsupportedL5XItems, 1);
  assert.ok(project.source.unsupportedRoutineContent.some((item) => item.name === "StructuredTextRoutine" && item.type === "ST"));
});

test("v15 preserves L5X XML line provenance for RLL writer evidence", () => {
  const project = analyzer.parseControllerSource(l5x, { fileName: "example.L5X" });
  const fault = project.faultWriters.find((item) => item.target === "Faults[1].3");
  assert.ok(fault);
  assert.equal(fault.writers.length, 1);
  assert.equal(fault.resets.length, 1);
  assert.equal(fault.writers[0].instruction, "OTL");
  assert.equal(fault.resets[0].instruction, "OTU");
  assert.equal(fault.writers[0].line, lineContaining(l5x, "XIC(GuardClosed)"));
  assert.equal(fault.resets[0].line, lineContaining(l5x, "XIC(ResetPB)"));
});

test("v15 carries alias, task scheduling, communication, MESSAGE and AFI evidence into existing phases", () => {
  const project = analyzer.parseControllerSource(l5x, { fileName: "example.L5X" });
  const alias = project.tags.find((tag) => tag.name === "GuardClosed");
  assert.ok(alias);
  assert.equal(alias.aliasFor, "Local:1:I.Data.0");
  assert.ok(project.ioReferences.includes("Local:1:I.Data.0"));

  const scheduling = project.dependencies?.taskScheduling;
  assert.ok(scheduling);
  assert.equal(scheduling.tasks[0]?.name, "MainTask");
  assert.equal(scheduling.scheduledPrograms[0]?.program, "FaultProgram");

  const communication = project.dependencies?.communicationTopology;
  assert.ok(communication?.produced?.some((tag) => tag.name === "PublishedState"));
  assert.ok(communication?.consumed?.some((tag) => tag.name === "RemoteState" && tag.consumed?.producer === "RemotePLC"));

  const messages = project.dependencies?.messageTopology;
  assert.ok(messages?.messageTags?.some((tag) => tag.name === "MsgRead"));
  assert.ok(messages?.calls?.some((call) => call.controlTag === "MsgRead"));
  assert.equal(project.afiAudit?.count, 1);
  assert.equal(project.afiReferences[0]?.line, lineContaining(l5x, "AFI()"));
});

test("v15 preserves interlock and recovery safety boundaries on normalized L5X", () => {
  const project = analyzer.parseControllerSource(l5x, { fileName: "example.L5X" });
  const interlockTopology = project.dependencies?.interlockTopology;
  const recoveryTopology = project.dependencies?.resetRecoveryTopology;
  const interlocks = JSON.stringify(interlockTopology || {});
  const recovery = JSON.stringify(recoveryTopology || {});
  assert.match(interlocks, /GuardClosed|StartPermissive/);
  assert.match(recovery, /ResetPB|Faults\[1\]\.3/);
  assert.equal(recoveryTopology.paths[0]?.runtimeExecutionProven, false);
  assert.equal(recoveryTopology.paths[0]?.causeClearedProven, false);
  assert.equal(recoveryTopology.paths[0]?.safeToResetProven, false);
  assert.match(recoveryTopology.sourceBoundary, /does not prove[\s\S]*safe to restart|Never use this analysis to force, bypass, or automatically reset/i);
  assert.doesNotMatch(`${interlocks} ${recovery}`, /reset now|perform reset|force this input|bypass the guard|bypass the safety/i);
});

test("v15 keeps L5K pass-through available and rejects binary ACD intake", () => {
  const l5k = `RSLogix 5000 Export Version 35.00\nCONTROLLER Demo\nPROGRAM Main\nROUTINE Logic\nRUNG 0\nN: XIC(Start)OTE(Faults[0].0);\nEND_RUNG\nEND_ROUTINE\nEND_PROGRAM\nEND_CONTROLLER`;
  const project = analyzer.parseControllerSource(l5k, { fileName: "demo.L5K" });
  assert.equal(project.source.sourceFormat, "L5K");
  assert.ok(project.faultWriters.some((item) => item.target === "Faults[0].0"));
  assert.throws(() => analyzer.parseControllerSource("binary-looking-placeholder", { fileName: "demo.ACD" }), /binary project file|L5K or L5X/i);
});

test("v15 adapter remains read-only and declares unsupported source boundaries", () => {
  const adapterSource = fs.readFileSync(path.join(root, "app/plc-analyzer/l5x-analyzer-adapter-v15.js"), "utf8");
  const provenanceSource = fs.readFileSync(path.join(root, "app/plc-analyzer/l5x-source-provenance-v15.js"), "utf8");
  const source = `${adapterSource}\n${provenanceSource}`;
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB/i);
  assert.match(source, /Non-RLL routine content/i);
  assert.match(source, /does not prove runtime state/i);
  assert.match(source, /ACD is a binary project file/i);
  assert.doesNotMatch(source, /force.*(?:input|output)|bypass.*(?:guard|safety)|write.*PLC/i);
});
