import type { TokenWindow } from "./tokens.ts";

export type RuleId = string & { readonly __brand: "RuleId" };

export type SlopCheck = (at: TokenWindow) => string | null;

export type SlopRule = {
  readonly id: RuleId;
  readonly check: SlopCheck;
};

const RULE_ID = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineSlopRule(id: string, check: SlopCheck): SlopRule {
  if (!RULE_ID.test(id)) {
    throw new Error(`slop rule id ${JSON.stringify(id)} must be kebab-case`);
  }
  return { id: id as RuleId, check };
}

const CHAINED_ASSERTION = defineSlopRule("chained-assertion", (at) => {
  if (
    at(0).text !== "as" ||
    (at(1).text !== "unknown" && at(1).text !== "any") ||
    at(2).text !== "as"
  ) {
    return null;
  }
  const middle = at(1).text;
  const target = at(3).text;
  const quoted = /^[A-Za-z0-9_$]+$/.test(target)
    ? `as ${middle} as ${target}`
    : `as ${middle} as`;
  return `\`${quoted}\` launders the type. The compiler now believes anything. Parse the value at the boundary (Zod, Valibot, or a guard) and keep the parsed type.`;
});

const ANY_ESCAPE = defineSlopRule("any-escape", (at) => {
  if (at(0).text !== "any") {
    return null;
  }
  const prev = at(-1).text;
  if (prev === ".") {
    return null;
  }
  if (prev === "as" && at(1).text === "as") {
    return null;
  }
  if (prev !== ":" && prev !== "as" && prev !== "<" && prev !== ",") {
    return null;
  }
  return "`any` discards the type evidence you had. Keep the precise type, or take `unknown` at the boundary and parse it.";
});

const UNKNOWN_RETURN = defineSlopRule("unknown-return", (at) =>
  at(0).text === "unknown" && at(-1).text === ":" && at(-2).text === ")"
    ? "Returning `unknown` hands the checking work to every caller. Parse before returning and return the parsed type."
    : null,
);

const EMPTY_CATCH = defineSlopRule("empty-catch", (at) => {
  if (at(0).text !== "catch") {
    return null;
  }
  let off = 1;
  if (at(off).text === "(") {
    const close = at(off).pair;
    if (close === undefined) {
      return null;
    }
    off = close + 1;
  }
  const block = at(off);
  if (block.text !== "{" || block.pair !== off + 1) {
    return null;
  }
  return "Empty catch swallows the error and its evidence. Handle it, rethrow it with `cause`, or narrow to the one case you expect.";
});

const CONDITIONAL_EMPTY_SPREAD = defineSlopRule("conditional-empty-spread", (at) => {
  if (at(0).text !== "..." || at(1).text !== "(") {
    return null;
  }
  const close = at(1).pair;
  if (close === undefined) {
    return null;
  }
  const emptyElse =
    at(close - 3).text === ":" &&
    at(close - 2).text === "{" &&
    at(close - 2).pair === close - 1;
  let emptyThen = false;
  for (let j = 2; j <= close - 3; j++) {
    if (at(j).text === "?" && at(j + 1).text === "{" && at(j + 1).pair === j + 2) {
      emptyThen = true;
      break;
    }
  }
  if (!emptyElse && !emptyThen) {
    return null;
  }
  return "Conditional empty spread hides an optional property from the type. Declare it as `key?: T` on the type and assign the value directly.";
});

export const DEFAULT_RULES: readonly [SlopRule, ...SlopRule[]] = [
  CHAINED_ASSERTION,
  ANY_ESCAPE,
  UNKNOWN_RETURN,
  EMPTY_CATCH,
  CONDITIONAL_EMPTY_SPREAD,
];
