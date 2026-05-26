# Projexor

> A foundation for building code-aware tools. Exposes project structure, AST data, file operations, and command execution.

---

## Installation

```bash
npm install @aimro/projexor
```

---

## Overview

Building an MCP server or any code-aware tool means solving the same plumbing problems every time — walking a project tree, parsing file AST, reading and writing files, running commands. `projexor` gives you all of that out of the box so you can focus on what your tool actually does.

- **No language guessing** — language is detected automatically from file extensions
- **No path confusion** — all operations are rooted and confined to your project path
- **Built for AI agents and MCP servers** — returns clean, normalized JSON your tools can reason about immediately

---

## Quick Start

```ts
import { loadProject } from '@aimro/projexor';

const project = loadProject({
  path: '/my/project',
  ignore: ['node_modules', 'dist'],
});

// Get the full project tree and AST in one call
const result = await project.getStructure({ path: '/src', ast: true });

if (result.success) {
  const { structure, ast } = result.data;

  // structure — file tree with line counts per file
  console.log(structure.tree);

  // ast — flat map of filePath → normalized ASTResult
  // imports, exports, functions (typed params, return type, JSDoc, line positions)
  // classes (methods, properties, JSDoc, line positions)
  for (const [filePath, fileAst] of Object.entries(ast)) {
    console.log(filePath, fileAst.functions);
  }
}

// Parse AST of a specific folder
const ast = await project.parseAST({
  path: '/src/features/auth',
  ignore: ['__tests__'],
});

if (ast.success) {
  ast.data; // Record<string, ASTResult>
}

// Read a specific function by name
const fn = await project.readFile({
  path: '/src/index.ts',
  nodeName: 'parseUser',
});

if (fn.success) {
  console.log(fn.data.content); // function source
  console.log(fn.data.startLine); // where it starts
  console.log(fn.data.endLine); // where it ends

  // Write to specific lines
  await project.writeFile({
    path: '/src/index.ts',
    content: '// updated',
    operation: 'overwrite',
    lines: { start: fn.data.startLine, end: fn.data.endLine },
  });
}

// Run a command
const build = await project.runCommand({
  command: 'npm',
  args: ['run', 'build'],
});

if (build.success) {
  console.log(build.data.stdout);
}
```

---

## API Overview

All operations go through `loadProject`, which sets the project root and confines every operation within it. See [Architecture & API Reference](./ARCHITECTURE.md#api-reference) for full parameter details and return type definitions.

| Function                                                   | Description                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `loadProject({ path, ignore? })`                           | Sets the project root and returns a context object with all functions bound to it                         |
| `project.getStructure({ path, ast? })`                     | Returns the directory file tree. Pass `ast: true` to also get a normalized AST map of all supported files |
| `project.parseAST({ path, ignore? })`                      | Parses a file, folder, or whole project and returns a normalized AST map keyed by file path               |
| `project.readFile({ path, nodeName? })`                    | Reads a whole file or a specific named function or class with its line positions                          |
| `project.writeFile({ path, content?, operation, lines? })` | Inserts, overwrites, or deletes content — whole file or specific line range                               |
| `project.createFile({ path, content })`                    | Creates a new file and any missing parent directories recursively                                         |
| `project.runCommand({ command, args, cwd?, timeout? })`    | Runs a command with `shell: false`, returns stdout, stderr, and exit code                                 |

Each function returns a result object — see [data model](./ARCHITECTURE.md#data-model) for full type definitions:

```ts
// success
{ success: true, data: T }

// failure
{ success: false, error: { code: string, message: string } }
```

---

## Supported Languages

| Language   | Extensions    |
| ---------- | ------------- |
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx` |

Language is detected automatically from the file extension — you never specify it. Additional languages will be added as peer dependencies.

---

## Error Handling

The library distinguishes between two categories of errors:

**Programmer errors → throw**
Wrong types, missing required arguments, invalid parameter combinations. Validated by Zod schemas before any file system or parser operation begins. These indicate a bug in the caller's code.

**Expected failures → FailureResult**
Anything that can go wrong with correct code returns a `FailureResult`. The library never throws for runtime conditions.

See [error codes](./ARCHITECTURE.md#error-handling) for the full list of error codes and when each is returned.

---

## Documentation

- [Architecture & API Reference](./ARCHITECTURE.md) — full API reference, data model, error codes, and architecture decisions

---

## License

[MIT](./LICENSE)
