import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

export type Finding = {
  readonly message: string;
  readonly line: number;
};

export type Diagnostic = Finding & {
  readonly ruleId: string;
};

export type SlopRule = {
  readonly id: string;
  readonly check: (source: string) => readonly Diagnostic[];
};

function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (source.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function findingsFor(
  source: string,
  pattern: RegExp,
  message: string,
): Finding[] {
  const findings: Finding[] = [];
  const global = new RegExp(pattern.source, "g");
  for (const match of source.matchAll(global)) {
    findings.push({ message, line: lineAt(source, match.index) });
  }
  return findings;
}

function asDiagnostic(id: string, finding: Finding): Diagnostic {
  if (typeof finding.message !== "string" || finding.message.length === 0) {
    throw new Error("finding message must be a non-empty string");
  }
  if (
    typeof finding.line !== "number" ||
    !Number.isInteger(finding.line) ||
    finding.line < 1
  ) {
    throw new Error("finding line must be a positive integer");
  }
  return { ruleId: id, message: finding.message, line: finding.line };
}

export function defineSlopRule(
  id: string,
  check: (source: string) => readonly Finding[],
): SlopRule {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("id must be a non-empty string");
  }
  if (typeof check !== "function") {
    throw new Error("check must be a function");
  }
  return Object.freeze({
    id,
    check(source: string): Diagnostic[] {
      return check(source).map((finding) => asDiagnostic(id, finding));
    },
  });
}

const chainedAssertion =
  "This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.";
const anyEscape =
  "any erases type evidence. Name the real type, or parse untrusted input at the boundary.";
const emptyCatch =
  "Empty catch discards the failure. Handle the error or rethrow it.";

const antiSlopRules: readonly SlopRule[] = Object.freeze([
  defineSlopRule("no-any-escape", (source) =>
    findingsFor(
      source,
      /(?::\s*any\b|\bas\s+any\b|any\[\])/,
      anyEscape,
    ),
  ),
  defineSlopRule("no-chained-type-assertions", (source) =>
    findingsFor(source, /as\s+(?:unknown|any)\s+as\b/, chainedAssertion),
  ),
  defineSlopRule("no-empty-catch", (source) =>
    findingsFor(source, /catch(?:\s*\([^)]*\))?\s*\{\s*\}/, emptyCatch),
  ),
]);

export function scanFile(
  path: string,
  rules: readonly SlopRule[],
): Diagnostic[] {
  if (typeof path !== "string" || path.length === 0) {
    throw new Error("path must be a non-empty string");
  }
  if (!Array.isArray(rules)) {
    throw new Error("rules must be an array");
  }
  const source = readFileSync(path, "utf8");
  const diagnostics: Diagnostic[] = [];
  for (const rule of rules) {
    diagnostics.push(...rule.check(source));
  }
  diagnostics.sort((left, right) => {
    const byLine = left.line - right.line;
    if (byLine !== 0) {
      return byLine;
    }
    return left.ruleId.localeCompare(right.ruleId);
  });
  return diagnostics;
}

export function assertClean(
  fixture: string,
  rules: readonly SlopRule[] = antiSlopRules,
): void {
  const diagnostics = scanFile(fixture, rules);
  assert.deepEqual(
    diagnostics,
    [],
    `expected no slop in ${fixture}, found ${diagnostics.length}`,
  );
}

export function assertReject(
  fixture: string,
  rules: readonly SlopRule[] = antiSlopRules,
): Diagnostic[] {
  const diagnostics = scanFile(fixture, rules);
  assert.ok(
    diagnostics.length >= 1,
    `expected slop in ${fixture}, found none`,
  );
  return diagnostics;
}
