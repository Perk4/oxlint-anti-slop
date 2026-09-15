import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertClean,
  assertReject,
  defineSlopRule,
  scanFile,
} from "./slop.ts";
import * as slop from "./slop.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures");
const cleanPath = path.join(fixtures, "clean.ts");
const slopPath = path.join(fixtures, "slop.ts");

const chainedAssertion =
  "This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.";
const anyEscape =
  "any erases type evidence. Name the real type, or parse untrusted input at the boundary.";
const emptyCatch =
  "Empty catch discards the failure. Handle the error or rethrow it.";

test("public function names are the four primitives", () => {
  const names = Object.entries(slop)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name)
    .sort();
  assert.deepEqual(names, [
    "assertClean",
    "assertReject",
    "defineSlopRule",
    "scanFile",
  ]);
});

test("defineSlopRule stamps ruleId onto each finding", () => {
  const rule = defineSlopRule("no-todo", (source) => {
    const index = source.indexOf("TODO");
    if (index < 0) {
      return [];
    }
    return [
      {
        message: "replace TODO with a decision",
        line: source.slice(0, index).split("\n").length,
      },
    ];
  });
  assert.deepEqual(rule.check("line one\nTODO later"), [
    {
      ruleId: "no-todo",
      message: "replace TODO with a decision",
      line: 2,
    },
  ]);
  assert.deepEqual(rule.check("nothing to flag"), []);
});

test("defineSlopRule rejects an empty id", () => {
  assert.throws(() => defineSlopRule("", () => []), /id must be a non-empty string/);
});

test("scanFile runs each rule against file text", () => {
  const rule = defineSlopRule("no-get-account", (source) => {
    const index = source.indexOf("getAccount");
    if (index < 0) {
      return [];
    }
    return [
      {
        message: "rename getAccount",
        line: source.slice(0, index).split("\n").length,
      },
    ];
  });
  assert.deepEqual(scanFile(cleanPath, [rule]), []);
  assert.deepEqual(scanFile(slopPath, [rule]), [
    {
      ruleId: "no-get-account",
      message: "rename getAccount",
      line: 6,
    },
  ]);
});

test("assertClean stays silent on known-good and assertReject flags slop", () => {
  assertClean(cleanPath);
  assert.deepEqual(assertReject(slopPath), [
    {
      ruleId: "no-any-escape",
      message: anyEscape,
      line: 6,
    },
    {
      ruleId: "no-chained-type-assertions",
      message: chainedAssertion,
      line: 8,
    },
    {
      ruleId: "no-empty-catch",
      message: emptyCatch,
      line: 10,
    },
  ]);
});

test("assertClean throws when the fixture is slop", () => {
  assert.throws(() => assertClean(slopPath), /expected no slop/);
});

test("assertReject throws when the fixture is clean", () => {
  assert.throws(() => assertReject(cleanPath), /expected slop/);
});

test("the gate source is itself clean", () => {
  assertClean(path.join(root, "src", "slop.ts"));
  assertClean(path.join(root, "src", "slop.test.ts"));
});
