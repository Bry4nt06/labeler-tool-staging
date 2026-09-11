"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "supabase/functions/servoforge-community/index.ts"), "utf8");

assert.ok(source.includes('if (type === "bundle") return json({ error: "Complete Setup uploads are no longer supported." }'),
  "The API must reject new Complete Setup uploads.");
assert.ok(source.includes('if (!authorName) return json({ error: "Display Name is required." }'),
  "The API must require Display Name.");
assert.ok(source.includes('if (zone.length < 2 || site.length < 2)'),
  "The API must require 2-3 character Zone and Site codes.");
assert.ok(source.includes('const spec = clean(body?.spec, 80).toLowerCase()'),
  "Browse must accept a Spec filter.");
assert.ok(source.includes('metadata.specs.some((value) => value.toLowerCase() === spec)'),
  "Browse must match uploads against Bottle or Brand Spec metadata.");
assert.ok(source.includes('...metadata.specs'), "Text search must include upload metadata tags.");

console.log("Community Edge Function metadata validation and filtering regression passed.");
