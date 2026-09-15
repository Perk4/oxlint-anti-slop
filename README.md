# oxlint-anti-slop

4-primitive learning tap: Oxlint-style anti-slop lint gate (from Better Stack).

Video: https://www.youtube.com/watch?v=mmrSYvYKD9g

The four primitives are `defineSlopRule`, `scanFile`, `assertClean`, and `assertReject`.

Better Stack's [This Linter Rejects AI Slop From Your Code](https://www.youtube.com/watch?v=mmrSYvYKD9g) walks Dillon Mulroy's [anti-slop](https://github.com/dmmulroy/anti-slop) Oxlint plugin. Agents emit code that typechecks and still has no evidence: `as unknown as T`, `: any`, empty `catch`. Those patterns compile. They fail later, with no type trail. Anti-slop rejects them with a message the agent can act on. Then the loop is generate, lint, fix, lint.

This package is that loop without Oxlint. It is not the plugin and it is not a product.

`defineSlopRule(id, check)` freezes a rule. `check` reads source text and returns `{ message, line }` findings. The rule stamps `id` onto each one. `scanFile(path, rules)` reads the file and concatenates diagnostics, sorted by line then rule id.

Built-in rules flag three low-evidence tells:

- `no-chained-type-assertions` for `as unknown as` and `as any as`. The compiler is told to drop every fact it had.
- `no-any-escape` for `: any`, `as any`, and `any[]`.
- `no-empty-catch` for `catch { }` and `catch (error) {}`. The failure is dropped, so nothing remains to handle.

The messages tell the next step. Parse untrusted input at the boundary. Name the real type. Handle the error or rethrow it. `fixtures/clean.ts` parses `unknown` and names `User`. `fixtures/slop.ts` launders JSON through `as unknown as Account`, returns `any`, and swallows the catch.

`assertClean(fixture)` scans with those rules and throws if any diagnostic remains. `assertReject(fixture)` throws if the scan is empty, and returns the diagnostics. Pass a rule list as the second argument to override the built-in set.

Nothing deploys. This is a teaching gate.

```
npm test
```
