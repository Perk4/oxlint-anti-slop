import { describe, expect, it } from "vitest";
import { assertClean, assertReject, defineSlopRule, scanFile } from "../src/index.ts";

const chainedMessage =
  "`as unknown as User` launders the type. The compiler now believes anything. Parse the value at the boundary (Zod, Valibot, or a guard) and keep the parsed type.";
const anyAsMessage =
  "`as any as Config` launders the type. The compiler now believes anything. Parse the value at the boundary (Zod, Valibot, or a guard) and keep the parsed type.";
const anyEscapeMessage =
  "`any` discards the type evidence you had. Keep the precise type, or take `unknown` at the boundary and parse it.";
const unknownReturnMessage =
  "Returning `unknown` hands the checking work to every caller. Parse before returning and return the parsed type.";
const emptyCatchMessage =
  "Empty catch swallows the error and its evidence. Handle it, rethrow it with `cause`, or narrow to the one case you expect.";
const emptySpreadMessage =
  "Conditional empty spread hides an optional property from the type. Declare it as `key?: T` on the type and assign the value directly.";

describe("scanFile", () => {
  it("returns zero diagnostics for the clean fixture, including comment and string decoys", () => {
    expect(scanFile("fixtures/clean.ts")).toEqual([]);
  });

  it("pins chained-assertion on both laundering sites", () => {
    expect(scanFile("fixtures/slop/chained-assertion.ts")).toEqual([
      {
        path: "fixtures/slop/chained-assertion.ts",
        ruleId: "chained-assertion",
        line: 5,
        column: 14,
        message: chainedMessage,
      },
      {
        path: "fixtures/slop/chained-assertion.ts",
        ruleId: "chained-assertion",
        line: 9,
        column: 14,
        message: anyAsMessage,
      },
    ]);
  });

  it("pins any-escape on an explicit any parameter", () => {
    expect(scanFile("fixtures/slop/any-escape.ts")).toEqual([
      {
        path: "fixtures/slop/any-escape.ts",
        ruleId: "any-escape",
        line: 1,
        column: 35,
        message: anyEscapeMessage,
      },
    ]);
  });

  it("pins unknown-return on a JSON.parse wrapper", () => {
    expect(scanFile("fixtures/slop/unknown-return.ts")).toEqual([
      {
        path: "fixtures/slop/unknown-return.ts",
        ruleId: "unknown-return",
        line: 1,
        column: 39,
        message: unknownReturnMessage,
      },
    ]);
  });

  it("pins empty-catch on a one-line catch and a two-line catch", () => {
    expect(scanFile("fixtures/slop/empty-catch.ts")).toEqual([
      {
        path: "fixtures/slop/empty-catch.ts",
        ruleId: "empty-catch",
        line: 4,
        column: 5,
        message: emptyCatchMessage,
      },
      {
        path: "fixtures/slop/empty-catch.ts",
        ruleId: "empty-catch",
        line: 11,
        column: 5,
        message: emptyCatchMessage,
      },
    ]);
  });

  it("pins conditional-empty-spread on a ternary empty object", () => {
    expect(scanFile("fixtures/slop/conditional-empty-spread.ts")).toEqual([
      {
        path: "fixtures/slop/conditional-empty-spread.ts",
        ruleId: "conditional-empty-spread",
        line: 6,
        column: 5,
        message: emptySpreadMessage,
      },
    ]);
  });

  it("runs a custom rule alone and returns a literal diagnostic array", () => {
    const flagDecode = defineSlopRule("flag-decode", (at) =>
      at(0).text === "decode" ? "found decode" : null,
    );
    expect(scanFile("fixtures/slop/unknown-return.ts", [flagDecode])).toEqual([
      {
        path: "fixtures/slop/unknown-return.ts",
        ruleId: "flag-decode",
        line: 1,
        column: 17,
        message: "found decode",
      },
    ]);
  });

  it("throws at the path and rule-id boundaries", () => {
    expect(() => defineSlopRule("Bad Id", () => null)).toThrow(
      'slop rule id "Bad Id" must be kebab-case',
    );
    expect(() => scanFile("fixtures/missing.ts")).toThrow(
      "cannot read fixtures/missing.ts:",
    );
    expect(() => scanFile("README.md")).toThrow('expected a .ts file, got "README.md"');
    expect(() => scanFile("fixtures/clean.tsx")).toThrow(
      'expected a .ts file, got "fixtures/clean.tsx"',
    );
  });

  it("throws on a duplicate rule id and on an empty message", () => {
    const flagExport = defineSlopRule("flag-export", (at) =>
      at(0).text === "export" ? "found export" : null,
    );
    expect(() => scanFile("fixtures/clean.ts", [flagExport, flagExport])).toThrow(
      'duplicate slop rule id "flag-export"',
    );
    const emptyMsg = defineSlopRule("empty-msg", (at) => (at(0).text === "export" ? "" : null));
    expect(() => scanFile("fixtures/clean.ts", [emptyMsg])).toThrow(
      'slop rule "empty-msg" returned an empty message',
    );
  });
});

describe("assertClean and assertReject", () => {
  it("accepts the clean fixture and lists every diagnostic when a slop file is claimed clean", () => {
    assertClean("fixtures/clean.ts");
    expect(() => assertClean("fixtures/slop/chained-assertion.ts")).toThrow(
      "assertClean(fixtures/slop/chained-assertion.ts) found 2 diagnostic(s):\n  fixtures/slop/chained-assertion.ts:5:14 chained-assertion ",
    );
  });

  it("returns chained-assertion diagnostics that quote the laundered expression", () => {
    const found = assertReject("fixtures/slop/chained-assertion.ts");
    expect(found[0]).toEqual({
      path: "fixtures/slop/chained-assertion.ts",
      ruleId: "chained-assertion",
      line: 5,
      column: 14,
      message: chainedMessage,
    });
    expect(found.length).toBe(2);
  });

  it("throws when the clean fixture is claimed to be slop", () => {
    expect(() => assertReject("fixtures/clean.ts")).toThrow(
      "assertReject(fixtures/clean.ts) found no diagnostics, so this fixture is not teaching anything. Add a slop pattern or point at the slop fixture.",
    );
  });
});

describe("the public api", () => {
  it("exports only the four functions", async () => {
    const api = await import("../src/index.ts");
    const fns = Object.entries(api)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name)
      .sort();
    expect(fns).toEqual(["assertClean", "assertReject", "defineSlopRule", "scanFile"]);
  });
});

describe("the library source", () => {
  it("passes the built-in gate", () => {
    expect(scanFile("src/tokens.ts")).toEqual([]);
    expect(scanFile("src/rules.ts")).toEqual([]);
    expect(scanFile("src/index.ts")).toEqual([]);
    assertClean("src/index.ts");
  });
});
