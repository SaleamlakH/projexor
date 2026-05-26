# Projexor — Architecture

This document captures every architectural decision made for Projexor. It is the source of truth for how the system is built, why decisions were made, and what rules must never be violated.

---

## Table of Contents

- [What It Is](#what-it-is)
- [Design Decisions](#design-decisions)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Module Responsibilities](#module-responsibilities)
- [API Reference](#api-reference)
- [Data Model](#data-model)
- [Error Handling](#error-handling)
- [Input Validation](#input-validation)
- [Versioning Policy](#versioning-policy)

---

## What It Is

A Node.js TypeScript library that gives developers building MCP servers and similar tools the plumbing they need out of the box — project structure traversal, AST parsing, file I/O, and command execution — so they can focus on their tool logic instead of wiring these primitives together from scratch.

`loadProject` is the primary and only way to use the library. It sets the project root and enforces a strict boundary — no operation can escape outside the root path. Language is never specified by the caller — it is detected automatically from file extensions.

**Primary user:** a developer building an MCP server who currently has to manually wire together file walking, AST parsing, and file I/O from scratch every time.

**Biggest risk:** tools built on top of this library don't deliver meaningfully better results than existing AI coding agents (Claude Code, Cursor, etc.) — so developers don't see enough reason to build with it.

---

## Design Decisions

### `loadProject` is the only entry point

Standalone functions without a project context introduce path ambiguity — relative to what? `loadProject` sets the root once, resolves all paths against it, and enforces a strict boundary. Standalone functions may be added in a future version based on real developer demand, not assumption.

### Language is detected from file extension

No caller ever specifies a language. The language mapper reads the file extension and picks the correct parser. This solves mixed-language projects naturally — each file is handled by the right parser without any caller configuration.

### Feature modules never call each other

All cross-feature orchestration lives exclusively in `index.ts`. This keeps modules independently testable and prevents cascading coupling as the library grows.

### `getStructure` with `ast: true` is orchestrated in `index.ts`

`structure/` returns the file tree. `ast/` parses files. Neither calls the other. When both are needed, `index.ts` calls each in sequence and combines the results.

### AST output is always normalized — never raw parser nodes

Callers must never be coupled to `ts-morph` or any underlying parser. The normalizer owns the mapping from parser nodes to the defined JSON schema. Swapping parsers in the future must not break callers.

### Error strategy — throw for programmer errors, FailureResult for runtime failures

Wrong types and missing required arguments throw immediately via Zod validation. File not found, parse failures, and command errors return a `FailureResult`. The caller decides what to do with failures — the library never decides for them.

### Language parsers are peer dependencies

Installing Projexor does not install parser libraries. Each language parser is installed only if the developer chooses to use that language. This keeps the base install lightweight.

---

## Tech Stack

| Layer             | Choice                               | Reason                                                                                             |
| ----------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Language          | TypeScript                           | Type safety for both internals and the public API                                                  |
| AST parsing       | ts-morph                             | Clean wrapper over the TS Compiler API, no native bindings, TS/JS only initially                   |
| Input validation  | Zod                                  | Declarative schemas, precise error messages, handles conditional parameter requirements cleanly    |
| Build             | tsup                                 | Dual ESM/CJS output, minimal config, industry standard for libraries                               |
| Testing           | Vitest                               | ESM-native, fast, seamless with TypeScript and tsup                                                |
| Package manager   | npm                                  | Universal, no extra tooling                                                                        |
| Command execution | execa                                | `shell: false` by default, promise-based, built-in timeout support, clean stdout/stderr as strings |
| Linting           | ESLint + `@typescript-eslint/strict` | Strict type-aware linting, catches bugs before they ship                                           |
| Formatting        | Prettier                             | Opinionated, zero-debate formatting                                                                |
| Git hooks         | Husky + lint-staged                  | Blocks bad commits, runs checks only on staged files                                               |
| Versioning        | Changesets                           | Automated versioning, changelog generation, and npm publishing                                     |
| CI                | GitHub Actions                       | Workflow dispatcher for versioning and releasing                                                   |
| Runtime           | Node.js                              | —                                                                                                  |

---

## Project Structure

```
projexor/
├── src/
│   ├── index.ts
│   ├── core/
│   │   ├── types.ts
│   │   ├── errors.ts
│   │   └── utils/
│   ├── structure/
│   │   ├── __tests__/
│   │   └── getStructure.ts
│   ├── languages/
│   ├── ast/
│   ├── files/
│   └── commands/
│
├── tests/
│   ├── integration/
│   │   └── loadProject.test.ts
│   └── fixtures/
│       ├── typescript.ts
│       └── javascript.js
│
├── .changeset/
├── .github/
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── CHANGELOG.md
├── README.md
└── ARCHITECTURE.md
```

---

## Module Responsibilities

| Module                    | Responsibility                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`                | Single root entry point, `loadProject` factory, and all cross-feature orchestration. The only place modules are composed together. |
| `core/types.ts`           | All shared TypeScript types and schemas. Pure definitions, no executable code.                                                     |
| `core/errors.ts`          | Error codes and error classes. Single source of truth for every error the library can produce.                                     |
| `core/utils/result.ts`    | `createSuccess(data)` and `createFailure(code, message)`. Every module uses these to construct result objects consistently.        |
| `structure/`              | Directory traversal, file discovery, ignore list application. No AST, no file I/O, no commands.                                    |
| `languages/index.ts`      | Language mapper — maps file extensions to the correct parser. Validates that a parser is installed before use.                     |
| `languages/typescript.ts` | TypeScript parser — wraps `ts-morph`, delegates to normalizer, returns `ASTResult`.                                                |
| `languages/javascript.ts` | JavaScript parser — wraps `ts-morph`, delegates to normalizer, returns `ASTResult`.                                                |
| `ast/`                    | `parseAST` orchestration — delegates to `languages/` to pick the right parser. No file I/O, no commands.                           |
| `ast/normalizer.ts`       | Maps parser nodes to the normalized `ASTResult` JSON schema.                                                                       |
| `files/`                  | `readFile`, `writeFile`, `createFile` with absolute path resolution and root boundary enforcement.                                 |
| `commands/`               | `execa` invocation, timeout handling, result packaging. No AST, no file I/O, no structure.                                         |

---

## API Reference

### `loadProject({ path, ignore? })`

Sets the project root and returns a context object with all functions bound to it. Every path passed to any function is resolved relative to this root and blocked from escaping above it.

| Parameter | Type       | Required                                              |
| --------- | ---------- | ----------------------------------------------------- |
| `path`    | `string`   | yes — absolute path to project root                   |
| `ignore`  | `string[]` | no — glob patterns applied globally to all operations |

```ts
import { loadProject } from 'projexor';

const project = loadProject({
  path: '/my/project',
  ignore: ['node_modules', 'dist', '**/*.test.ts'],
});
```

**Returns:** `ProjectContext` — object with all functions bound to the root.

---

### `project.getStructure({ path })`

Walks the directory at `path` and returns a JSON file tree. All files not matching the global ignore list are included regardless of extension. When `ast: true`, also parses supported files and returns a flat AST map alongside the tree — orchestrated in `index.ts`, `structure/` and `ast/` never call each other.

| Parameter | Type      | Required                 |
| --------- | --------- | ------------------------ |
| `path`    | `string`  | yes                      |
| `ast`     | `boolean` | no — defaults to `false` |

```ts
// structure only
const result = await project.getStructure({ path: '/src' });

if (result.success) {
  result.data.structure; // ProjectStructure
}

// structure + AST
const result = await project.getStructure({ path: '/src', ast: true });

if (result.success) {
  result.data.structure; // ProjectStructure
  result.data.ast; // Record<string, ASTResult>
}
```

**Returns:**

```ts
// ast: false
SuccessResult<{ structure: ProjectStructure }>;

// ast: true
SuccessResult<{ structure: ProjectStructure; ast: Record<string, ASTResult> }>;
```

---

### `project.parseAST({ path, ignore? })`

Parses a single file, a folder (always recursive), or the whole project. Language detected from extension. Unsupported extensions return `{ supported: false }`. Supported extensions with no installed parser throw `PARSER_NOT_INSTALLED` immediately. Local `ignore` extends — never replaces — the global ignore set by `loadProject`.

| Parameter | Type       | Required                                      |
| --------- | ---------- | --------------------------------------------- |
| `path`    | `string`   | yes                                           |
| `ignore`  | `string[]` | no — extends global ignore for this call only |

```ts
const result = await project.parseAST({
  path: '/src/features/auth',
  ignore: ['__tests__', '**/*.spec.ts'],
});

if (result.success) {
  result.data; // Record<string, ASTResult> — filePath → ASTResult
}
```

**Returns:** `SuccessResult<Record<string, ASTResult>>`

---

### `project.readFile({ path, nodeName? })`

Reads a file and returns its raw text content. If `nodeName` is provided, returns only that named node (function or class) along with its start and end line numbers.

| Parameter  | Type     | Required                                    |
| ---------- | -------- | ------------------------------------------- |
| `path`     | `string` | yes                                         |
| `nodeName` | `string` | no — name of a function or class to extract |

```ts
// read whole file
const result = await project.readFile({ path: '/src/index.ts' });

if (result.success) {
  result.data; // string
}

// read a named node
const result = await project.readFile({
  path: '/src/index.ts',
  nodeName: 'parseUser',
});

if (result.success) {
  result.data.content; // string
  result.data.startLine; // number
  result.data.endLine; // number
}
```

**Returns:**

```ts
// without nodeName
SuccessResult<string>;

// with nodeName
SuccessResult<{ content: string; startLine: number; endLine: number }>;
```

---

### `project.writeFile({ path, content?, operation, lines? })`

Writes to an existing file. Behavior controlled by `operation` and `lines`.

| Parameter   | Type                                  | Required                                                    |
| ----------- | ------------------------------------- | ----------------------------------------------------------- |
| `path`      | `string`                              | yes                                                         |
| `content`   | `string`                              | yes for `insert` and `overwrite`, not required for `delete` |
| `operation` | `'insert' \| 'overwrite' \| 'delete'` | yes                                                         |
| `lines`     | `{ start: number, end?: number }`     | no — omitting means full file                               |

| operation   | lines            | behavior                                |
| ----------- | ---------------- | --------------------------------------- |
| `overwrite` | omitted          | replace entire file content             |
| `overwrite` | `{ start }`      | overwrite from that line to end of file |
| `overwrite` | `{ start, end }` | overwrite between start and end lines   |
| `insert`    | `{ start }`      | insert content at that line             |
| `delete`    | `{ start }`      | delete that single line                 |
| `delete`    | `{ start, end }` | delete between start and end lines      |

```ts
// overwrite whole file
await project.writeFile({
  path: '/src/index.ts',
  content: 'export const x = 1',
  operation: 'overwrite',
});

// insert at line 10
await project.writeFile({
  path: '/src/index.ts',
  content: '// inserted line',
  operation: 'insert',
  lines: { start: 10 },
});

// delete lines 10–25
await project.writeFile({
  path: '/src/index.ts',
  operation: 'delete',
  lines: { start: 10, end: 25 },
});

if (result.success) {
  result.data.path; // string
  result.data.startLine; // number
  result.data.endLine; // number
}
```

**Returns:** `SuccessResult<{ path: string, startLine: number, endLine: number }>`

---

### `project.createFile({ path, content })`

Creates a new file with the given content. Creates any missing parent directories recursively. Returns `FILE_ALREADY_EXISTS` if the file already exists.

| Parameter | Type     | Required |
| --------- | -------- | -------- |
| `path`    | `string` | yes      |
| `content` | `string` | yes      |

```ts
const result = await project.createFile({
  path: '/src/utils/new.ts',
  content: 'export {}',
});

if (result.success) {
  result.data.path; // string
  result.data.lines; // number
}
```

**Returns:** `SuccessResult<{ path: string, lines: number }>`

---

### `project.runCommand({ command, args, cwd?, timeout? })`

Executes a command via `execa` with `shell: false`. `cwd` defaults to the project root. Timeout is optional — if exceeded, kills the process and returns `COMMAND_TIMEOUT`.

| Parameter | Type       | Required                      |
| --------- | ---------- | ----------------------------- |
| `command` | `string`   | yes                           |
| `args`    | `string[]` | yes                           |
| `cwd`     | `string`   | no — defaults to project root |
| `timeout` | `number`   | no — milliseconds             |

```ts
const result = await project.runCommand({
  command: 'npm',
  args: ['run', 'build'],
  timeout: 30000,
});

if (result.success) {
  result.data.stdout; // string
  result.data.stderr; // string
  result.data.exitCode; // number
}
```

**Returns:** `SuccessResult<{ stdout: string, stderr: string, exitCode: number }>`

---

## Data Model

All data is in-memory JSON. No database, no persistent storage. The library is stateless between calls.

### Result wrapper

```ts
SuccessResult<T> { success: true,  data: T }
FailureResult    { success: false, error: { code: ErrorCode, message: string } }
```

### `ProjectStructure`

```ts
{ root: string, tree: FileNode[] }
```

### `FileNode`

```ts
{
  name:     string
  path:     string              // absolute
  type:     'file' | 'directory'
  lines:    number | null       // null for directories
  children: FileNode[]
}
```

### `ASTResult`

```ts
{
  filePath:  string
  lines:     number
  supported: boolean            // false if extension has no registered parser
  imports:   Import[]
  exports:   Export[]
  functions: Function[]
  classes:   Class[]
}
```

### Supporting types

```ts
Import    { name: string, source: string, line: number }
Export    { name: string, type: 'function' | 'class' | 'variable' | 'default', line: number }
Function  { name: string, parameters: Parameter[], returnType: string, jsDoc: string | null, startLine: number, endLine: number }
Parameter { name: string, type: string }
Class     { name: string, methods: Function[], properties: Property[], jsDoc: string | null, startLine: number, endLine: number }
Property  { name: string, type: string }
```

---

## Error Handling

**Programmer errors → throw** via Zod validation before any operation begins.

**Runtime failures → FailureResult** — the library never decides what to do with failures.

### All error codes

| Code                   | When                                                      |
| ---------------------- | --------------------------------------------------------- |
| `FILE_NOT_FOUND`       | Path does not exist                                       |
| `FILE_ALREADY_EXISTS`  | `createFile` called on an existing path                   |
| `NODE_NOT_FOUND`       | `nodeName` passed to `readFile` but not found in the file |
| `PARSE_FAILED`         | Parser could not parse the file                           |
| `PARSER_NOT_INSTALLED` | Supported extension but peer dependency not installed     |
| `UNSUPPORTED_LANGUAGE` | Extension has no registered parser                        |
| `COMMAND_FAILED`       | Process exited with non-zero code                         |
| `COMMAND_TIMEOUT`      | Process exceeded optional timeout                         |
| `PERMISSION_DENIED`    | File system permission error                              |
| `INVALID_OPERATION`    | Invalid line range or malformed operation parameters      |
| `PATH_OUTSIDE_ROOT`    | Path attempts to escape the root set by `loadProject`     |

---

## Input Validation

All function inputs are validated with Zod schemas before any operation begins. Validation errors throw immediately — they are programmer errors, not runtime failures.

Each function has its own Zod schema. Conditional requirements (e.g. `content` not required for `delete`, `end` optional on `lines`) are expressed in the schema — not scattered across function bodies.

---

## Versioning Policy

Projexor uses [Changesets](https://github.com/changesets/changesets) for versioning and changelog generation.

| Bump    | When                                                                                              |
| ------- | ------------------------------------------------------------------------------------------------- |
| `major` | Breaking API change, `ASTResult` schema change, removed or renamed function, changed return shape |
| `minor` | New function, new parameter on existing function, new language support added                      |
| `patch` | Bug fix, performance improvement, internal refactor, documentation update                         |

Every change that ships must have a changeset file. No exceptions.
