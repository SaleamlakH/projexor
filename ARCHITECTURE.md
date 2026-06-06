# Architecture

This document exists for contributors. It explains why the system is built the way it is, the rules that must not be violated, and the boundaries that must not be crossed. The public API is documented in [`docs/api.md`](docs/api.md). The data models are in [`docs/models.md`](docs/models.md).

---

## Table of Contents

- [Overview](#overview)
- [Architectural Principles](#architectural-principles)
- [Directory Structure & Module Topology](#directory-structure--module-topology)
- [Data Flow & Execution Lifecycle](#data-flow--execution-lifecycle)
- [Public API Surface & Extension Points](#public-api-surface--extension-points)

---

## Overview

Projexor is a library for developers building AI coding tools, MCP servers, and other code-aware tools. It provides project structure traversal, AST parsing, file I/O, and command execution.

The motivation for this project is to have execution and inspection layer for developers building AI infrastructure like MCP servers. Agents need to work with codebases the way a careful developer would, **understanding structure before acting, operating within boundaries, never touching more than necessary** instead of relying on broad, token-heavy file dumps. And AI chat interfaces need real codebase context without the developer manually copying files into the conversation.

### What it provides

Four capabilities, composable in any order:

- **Structure**: walk a directory tree and understand what exists

- **AST parsing**: understand what specific files contain at the structural level, without reading raw source

- **File I/O**: read and write files with precise line-level control.

- **Command execution**: run commands within the project boundary. Act on the codebase in a controlled way.

They are designed to be used in sequence, structure first, then AST, then targeted read/write. An agent that follows this pattern touches only what it understands and changes only what it intends to.

### Who uses it

Developers building AI coding tools, MCP servers, and any system that needs structured, bounded access to a codebase without wiring these primitives together from scratch every time.

### Scope Boundary

Projexor is a foundation layer. It does not make decisions about what to read or write. It does not interpret code semantically. It does not communicate with any AI model. It provides the primitives and enforces the constraints.

---

## Architectural Principles

These principles are not preferences. Every one of them has a reason, and every one of them affects how the library behaves for the tools built on top of it. A contributor adding a new operation or extending an existing one must understand and follow all of them.

### Single entry point

[`loadProject`](docs/api.md#loadproject) is the only way to use the library. `loadProject` sets the project root once, and every subsequent operation is resolved and checked against it. A standalone function has no root to resolve against, which means no boundary to enforce.

### Understanding structure before acting

The four capabilities are sequenced deliberately. Structure tells you what files exist. AST tells you what those files contain and where. File I/O operates on specific positions identified by AST. This sequence is not enforced by the API. The caller can call them in any order but it is the intended pattern.

### Operating within boundaries

Every resolved path is checked against the project root before any operation proceeds. A path that escapes the root throws `PATH_OUTSIDE_ROOT` immediately. This is the most important invariant in the library.

This boundary also will be implemented for commands that will affecting the environment outside root.

### Language is always detected, never specified

No caller ever passes a language identifier. The library reads the file extension and selects the correct parser.

This is what makes Projexor usable on polyglot codebases — a real-world requirement for any AI coding tool. Adding language support means adding to the registry, not changing any calling convention.

This solves mixed-language projects without any configuration. When a new language is added, it will be added to the registry and becomes available automatically.

### AST output is always normalized

Raw parser nodes are never returned to callers. The normalizer maps parser internals to the defined schema. Callers are coupled to the schema, not to the underlying parser. This means the parser can be swapped, upgraded, or replaced without breaking any tool built on top of Projexor. The schema is an API contract. Any change to it after release is a breaking change.

### Feature modules never call each other

All cross-feature orchestration lives exclusively in `src/index.ts`. `structure/` never calls `ast/`. `ast/` never calls `files/`. This keeps every module independently testable and prevents coupling that compounds invisibly as the library grows. If you find yourself importing one feature module from another, the orchestration belongs in `index.ts`.

### Fail fast on bad input, tolerant on operational failures

Bad inputs, such as wrong path, missing required argument, invalid operation, throws immediately before any work begins.

Operational failures during list processing, a file that cannot be parsed, a language with no registered parser, go into an `errors` map and processing continues. The caller decides what to do with failures.

### Command execution never uses shell interpolation

`execa` is called with `shell: false` always. No exceptions. Shell interpolation is a security boundary that must not be crossed, especially in a library that is designed to be driven by an AI agent. Arguments are always passed as a discrete array.

## Directory Structure & Module Topology

```
projexor/
├── src/
│   ├── index.ts        # loadProject factory and all cross-feature orchestration
│   ├── core/           # shared types, error codes, error class
│   ├── structure/      # directory traversal and file tree construction
│   ├── ast/            # parseAST orchestration
│   │   ├── languages/      # language registry, extension mapping, per-language parsers
│   ├── files/          # readFile and writeFile
│   └── commands/       # runCommand
└── docs/               # public-facing documentation
```

### Import hierarchy

Strict. Never violated.

```
index.ts        → all feature modules
feature modules → core/ only
core/           → nothing outside core/
```

Feature modules never import from each other. `index.ts` is the only file that composes them. `core/` is pure definitions. it has no dependencies on feature modules.

## Data Flow & Execution Lifecycle

### [loadProject](docs/api.md#loadproject)

Synchronous. Validates that the path is absolute, exists, is a directory and is within the root directory. Resolves it to an absolute path. Stores the resolved root, ignore patterns, and parser options in a closure. Returns a plain `ProjectContext` object with all operations as closures bound to the root.

### Validation order — every operation

Every operation follows this sequence before doing any work:

```
1. path resolve against root
2. boundary check    → throw PATH_OUTSIDE_ROOT if outside root
3. existence check   → throw FILE_NOT_FOUND or DIRECTORY_NOT_FOUND if missing
4. type check        → throw NOT_A_DIRECTORY or NOT_A_FILE if wrong type
5. proceed
```

### List operations — pre-flight vs processing

For [`parseAst`](docs/api.md#parseast) called with a list of paths, all paths are pre-flight validated before any parsing begins. If any path fails the boundary or existence check, the entire call throws immediately. Only failures that occur during processing go into the `errors` map. Processing continues for remaining files.

### AST parsing (TS/JS) — single file vs list

Single file calls use `ts.createSourceFile` lightweight, no program context needed. List calls use `ts.createProgram` one instantiation for the entire batch, which is significantly more efficient than creating a source file per file. Both produce `TSASTResult` via the same normalizer. The caller never sees this distinction.

### File I/O — streaming and atomicity

[`readFile`](docs/api.md#readfile) with a line range uses a single streaming pass. The stream is destroyed immediately when the end line is reached. Only the requested lines are held in memory at any point.

[`writeFile`](docs/api.md#writefile) uses a single streaming pass through the original file into a tmp file, then an atomic rename. The rename is atomic at the OS level on the same filesystem. A crash before the rename leaves the original untouched. A crash after leaves a harmless orphaned tmp file. The file is either fully written or unchanged.

### Command execution — buffered and streaming

[`runCommand`](docs/api.md#runcommand) operates in two modes depending on whether `onOutput` callback is provided. Buffered mode accumulates all output and returns it after the process exits. Streaming mode fires `onOutput` with each chunk in real time and still returns the full [`CommandResult`](docs/models.md#commandresult) after exit. `runCommand` never throws on non-zero exit codes except for `timeout`. `exitCode` is always returned and the caller decides what to do with it.

### [Error handling](docs/errors.md)

All errors thrown by the library are instances of [`ProjexorError`](docs/errors.md#projexorerror) with a stable `code` field drawn from the `ErrorCode` const object. No subclasses. The `code` field is safe to switch on. An optional `cause` field carries the underlying error when one exists. `COMMAND_TIMEOUT` carries the partial output written before the process was killed.

`ErrorCode` is exported as both a value (`import { ErrorCode }`) and a type (`import type { ErrorCode }`).

See [`docs/errors.md`](docs/errors.md) for the full error code registry.

---

## Public API Surface & Extension Points

### Public surface

The public API is everything exported from the package root. Values: `loadProject`, `ProjexorError`, `ErrorCode`. Types: all option types, result types, AST model types, and context types. Everything a caller might need to name explicitly is exported.

See [`docs/api.md`](docs/api.md) for the full API reference.

### Adding a new language

Adding a language is the primary extension point. The steps are:

1. Add the new language key to [`LanguageKey`](docs/languages.md#language-keys) in `core/types.ts`
2. Add the new result type extending [`BaseASTResult`](docs/models.md#astresult) in `core/types.ts`
3. Add it to the [`ASTResult`](docs/models.md#astresult) union
4. Register the extensions and parser in `LANGUAGE_REGISTRY` in `languages/index.ts`
5. Add the language key to [`parserOptions`] in `LoadProjectOptions`
6. Write the parser in `ast/languages/`
7. Add fixture files in `tests/fixtures/` covering all node types for the new language
8. Add parser tests

The caller-facing API does not change. Existing language keys and result types are never modified.

### Adding a new operation

A new operation follows the same pattern as all existing ones:

- Implement in its own feature module under `src/`
- Import and expose it only through `index.ts`
- Follow the validation order — boundary check, existence check, type check, then work
- Throw `ProjexorError` for all failures — no new error classes, no new result wrappers
- Add the operation to `ProjectContext` in `core/types.ts`
- Export any new option and result types from the package root

### What is out of scope

These are features explicitly decided against. Do not build them unless a deliberate decision is made to include them:

- Standalone functions without `loadProject`
- Cross-file type resolution or type inference
- AST-based code rewriting
- Watch mode or incremental re-parsing
- Built-in AST result caching

### Tech stack

| Layer             | Choice                               | Reason                                                                                                 |
| ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Language          | TypeScript                           | Type safety for both internals and the public API                                                      |
| AST parsing       | TypeScript Compiler API              | No native bindings, handles TS and JS, `noResolve` keeps parsing fast and self-contained               |
| Input validation  | Zod                                  | Declarative schemas, precise error messages, handles conditional parameter requirements cleanly        |
| Build             | tsup                                 | Dual ESM/CJS output, minimal config                                                                    |
| Testing           | Vitest                               | ESM-native, fast, seamless with TypeScript and tsup                                                    |
| Command execution | execa                                | `shell: false` by default, promise-based, built-in timeout, interleaved stdout+stderr via `all` stream |
| Ignore patterns   | micromatch                           | Glob matching against relative paths                                                                   |
| Linting           | ESLint + `@typescript-eslint/strict` | Strict type-aware linting                                                                              |
| Formatting        | Prettier                             | Zero-debate formatting                                                                                 |
| Git hooks         | Husky + lint-staged                  | Blocks bad commits, runs checks on staged files only                                                   |
| Versioning        | Changesets                           | Automated versioning, changelog generation, npm publishing                                             |
| CI                | GitHub Actions                       | Release pipeline                                                                                       |

### Versioning policy

| Bump    | When                                                                                             |
| ------- | ------------------------------------------------------------------------------------------------ |
| `major` | Breaking API change — removed or renamed export, changed return shape, `ASTResult` schema change |
| `minor` | New operation, new parameter on existing operation, new language support                         |
| `patch` | Bug fix, performance improvement, internal refactor, documentation update                        |

Every change that ships must have a changeset file.

### Release pipeline

```
Developer writes changeset
→ PR merged to main
→ GitHub Actions detects pending changesets
→ Workflow dispatcher triggered manually
→ Changesets bumps version in package.json
→ CHANGELOG.md updated automatically
→ Package published to npm
```
