# oxlint-anti-slop

4-primitive learning tap: Oxlint-style anti-slop lint gate (from Better Stack).

Video: https://www.youtube.com/watch?v=mmrSYvYKD9g

This package is a lint gate you can read. It is not oxlint. It is not a product.

## Why the gate exists

TypeScript compiles `raw as unknown as User`. Tests can still pass. The compiler has dropped every fact it had about `raw`. Dillon Mulroy calls that type laundering. The [Better Stack guide](https://betterstack.com/community/guides/ai/anti-slop-oxlint/) and the [anti-slop](https://github.com/dmmulroy/anti-slop) plugin catch that pattern. The agent reads the diagnostic and parses at the boundary instead of recasting.

This repo teaches that loop as four functions.

## The four functions

`defineSlopRule` mints a kebab-case id and a check. A check receives a token window `at` and returns a message or `null`. It cannot set the path, the rule id, the line, or the column.

`scanFile` reads one `.ts` file and runs the built-in rules unless you pass your own non-empty list. Diagnostics come back in source order because the outer loop is over tokens.

`assertClean` scans a known-good fixture and throws if anything fired. The error lists every `path:line:column ruleId message`.

`assertReject` scans a slop fixture and throws if nothing fired. On success it returns a non-empty tuple. `const [first] = assertReject(...)` needs no `!`.

## How a check sees the file

`tokenize` drops whitespace, comments, string literals, template literals, interpolations inside those templates, and regex literals. `fixtures/clean.ts` can name `as any` in a comment and in a string and still pass.

Brackets carry `pair`. An empty block is `block.pair === index + 1`. `catch (error) {` with the closer on the next line is still empty. The newline is already gone.

`at(offset)` is total. Out of range returns `{ text: "", line: 0, column: 0 }`.

## The built-in rules

1. `chained-assertion` flags `as unknown as T` and `as any as T`.
2. `any-escape` flags `: any`, `as any`, `<any>`, and `, any`. It stays silent on `Promise.any` and on the middle of `as any as`.
3. `unknown-return` flags `): unknown`. An `unknown` parameter is allowed.
4. `empty-catch` flags `catch {}` and `catch (error) {}`.
5. `conditional-empty-spread` flags `...(cond ? { key } : {})` and the mirrored empty then-branch.

## Usage

```ts
import { assertClean, assertReject, defineSlopRule, scanFile } from "./src/index.ts";

assertClean("fixtures/clean.ts");
const [first] = assertReject("fixtures/slop/chained-assertion.ts");
console.log(first.ruleId, first.message);

for (const found of scanFile("src/index.ts")) {
	console.log(`${found.path}:${found.line}:${found.column} ${found.ruleId} ${found.message}`);
}

const unknownParam = defineSlopRule("unknown-param", (at) =>
	at(0).text === "unknown" && at(-1).text === ":" && at(1).text === ")"
		? "This parameter accepts anything. Parse the value here and give it the parsed type."
		: null,
);
scanFile("src/index.ts", [unknownParam]);
```

## How to run

```sh
npm install
npm test
npm run typecheck
```

`npm test` typechecks `src`, `test`, and `fixtures`, then runs Vitest. The slop fixtures compile under `strict`. The gate is what rejects them.

## Not oxlint. Not a product.

There is no oxlint dependency, no plugin, no CLI wrap, and no cloud. The lesson is the four functions and the fixtures they read.
