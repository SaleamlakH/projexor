# Supported Languages

**See also:** [API Reference](api.md) · [Data Models](models.md)

---

## Language keys

Languages are identified internally by a `LanguageKey`. This is the vocabulary used in `parseAstListOptions.languages`, `parserOptions`, and `ASTResult.language`.

```ts
type LanguageKey = 'ts' | 'js';
```

Adding a new language is a minor version bump — it adds a new key to the union without changing existing ones.

---

## Supported extensions

| Extension | Language key | Parser                                    |
| --------- | ------------ | ----------------------------------------- |
| `.ts`     | `'ts'`       | TypeScript Compiler API                   |
| `.tsx`    | `'ts'`       | TypeScript Compiler API                   |
| `.js`     | `'js'`       | TypeScript Compiler API (`allowJs: true`) |
| `.jsx`    | `'js'`       | TypeScript Compiler API (`allowJs: true`) |
| `.mjs`    | `'js'`       | TypeScript Compiler API (`allowJs: true`) |
| `.cjs`    | `'js'`       | TypeScript Compiler API (`allowJs: true`) |

TypeScript and JavaScript share the same parser internally. The `language` field on the result reflects the actual language family — not the parser used.

Files with any other extension throw [`UNSUPPORTED_LANGUAGE`](errors.md#error-codes) for single-file `parseAst`, or go into the `errors` map for list inputs. Pass `skipUnsupported: true` to silently drop them instead.

---

## Language detection

Language is always detected from the file extension. Callers never specify a language explicitly.

```
1. path.extname(inputPath)         → '.ts'
2. look up extension in registry   → language key 'ts'
3. pick parser for 'ts'            → TypeScript Compiler API
4. result.language                 → 'ts'
```

`.tsx` and `.jsx` map to `'ts'` and `'js'` respectively — the JSX variant is an extension detail handled internally by the parser.

---

## Peer dependency

AST parsing requires the `typescript` package to be installed in your project. It is a peer dependency — not bundled with Projexor.

```bash
npm install typescript
```

If `typescript` is not installed and `parseAst` is called on a supported extension, [`PARSER_NOT_INSTALLED`](errors.md#error-codes) is thrown.

---

## Parser options

Compiler behavior can be tuned per language key via `parserOptions` on [`loadProject`](api.md#loadproject).

```ts
const project = loadProject({
  path: '/workspace/myapp',
  parserOptions: {
    ts: { target: ts.ScriptTarget.ES2020 },
    js: { target: ts.ScriptTarget.ES2015 },
  },
});
```

Options are merged on top of the defaults — caller options win on any key they provide.

### Default compiler options

```ts
{
  allowJs:              true,
  jsx:                  ts.JsxEmit.Preserve,
  skipLibCheck:         true,
  skipDefaultLibCheck:  true,
  noResolve:            true,    // always enforced — never follows imports
  target:               ts.ScriptTarget.Latest
}
```

`noResolve: true` is always set regardless of what the caller passes. Projexor never follows imports across files during parsing.

---

## Filtering by language

When calling `parseAst` with a list of files, the `languages` option limits processing to files matching specific language keys:

```ts
// only process .ts and .tsx — all other files silently skipped
const { results } = await project.parseAst(files, { languages: ['ts'] });

// only process .js, .jsx, .mjs, .cjs
const { results } = await project.parseAst(files, { languages: ['js'] });
```

Files filtered out by `languages` never appear in `results` or `errors`. This is distinct from `skipUnsupported`, which only drops files with no registered parser.

---

## Future languages

Each future language will have its own result type extending `BaseASTResult`, its own language key added to `LanguageKey`, and its own entry in `parserOptions`. Existing language keys and result types are never changed when new languages are added.

```ts
// today
type ASTResult = TSASTResult;

// future
type ASTResult = TSASTResult | PythonASTResult | RustASTResult;
```

Narrowing by `language` is the correct pattern for writing code that will remain valid as new languages are added.
