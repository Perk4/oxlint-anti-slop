import { readFileSync } from "node:fs";
import { DEFAULT_RULES } from "./rules.ts";
import type { RuleId, SlopRule } from "./rules.ts";
import type { Position, Token } from "./tokens.ts";
import { tokenize, windowAt } from "./tokens.ts";

export { defineSlopRule } from "./rules.ts";
export type { RuleId, SlopCheck, SlopRule } from "./rules.ts";
export type { Position, Token, TokenWindow } from "./tokens.ts";

export type SourcePath = string & { readonly __brand: "SourcePath" };

export type Diagnostic = Position & {
  readonly path: SourcePath;
  readonly ruleId: RuleId;
  readonly message: string;
};

type SourceFile = {
  readonly path: SourcePath;
  readonly tokens: readonly Token[];
};

function openSource(path: string): SourceFile {
  if (!path.endsWith(".ts")) {
    throw new Error(`expected a .ts file, got ${JSON.stringify(path)}`);
  }
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot read ${path}: ${reason}`);
  }
  return { path: path as SourcePath, tokens: tokenize(text) };
}

export function scanFile(
  path: string,
  rules: readonly [SlopRule, ...SlopRule[]] = DEFAULT_RULES,
): readonly Diagnostic[] {
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      throw new Error(`duplicate slop rule id ${JSON.stringify(rule.id)}`);
    }
    seen.add(rule.id);
  }
  const file = openSource(path);
  const found: Diagnostic[] = [];
  for (let index = 0; index < file.tokens.length; index++) {
    const cursor = file.tokens[index];
    if (cursor === undefined) {
      break;
    }
    const at = windowAt(file.tokens, index);
    for (const rule of rules) {
      const message = rule.check(at);
      if (message === null) {
        continue;
      }
      if (message === "") {
        throw new Error(
          `slop rule ${JSON.stringify(rule.id)} returned an empty message`,
        );
      }
      found.push({
        path: file.path,
        ruleId: rule.id,
        line: cursor.line,
        column: cursor.column,
        message,
      });
    }
  }
  return found;
}

function formatDiagnostic(d: Diagnostic): string {
  return `${d.path}:${d.line}:${d.column} ${d.ruleId} ${d.message}`;
}

export function assertClean(fixture: string): void {
  const found = scanFile(fixture);
  if (found.length === 0) {
    return;
  }
  throw new Error(
    [
      `assertClean(${fixture}) found ${found.length} diagnostic(s):`,
      ...found.map((d) => `  ${formatDiagnostic(d)}`),
    ].join("\n"),
  );
}

function isNonEmpty<T>(items: readonly T[]): items is readonly [T, ...T[]] {
  return items.length > 0;
}

export function assertReject(fixture: string): readonly [Diagnostic, ...Diagnostic[]] {
  const found = scanFile(fixture);
  if (isNonEmpty(found)) {
    return found;
  }
  throw new Error(
    `assertReject(${fixture}) found no diagnostics, so this fixture is not teaching anything. Add a slop pattern or point at the slop fixture.`,
  );
}
