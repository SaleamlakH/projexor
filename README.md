# Projexor

> A foundation for building code-aware tools. Exposes project structure, AST data, file operations, and command execution.

---

## Installation

```bash
npm install @aimro/projexor
```

**Peer dependencies**

AST parsing for TS/JS requires the TypeScript compiler:

```bash
npm install typescript
```

---

## Overview

Projexor is a library for developers building AI coding tools, MCP servers, and other code-aware tools. It provides:

- Walking project structure
- Parsing AST
- Reading and writing files
- Running commands safely

The motivation for this project is to have execution and inspection layer for developers building AI infrastructure like MCP servers. Agents need to work with codebases the way a careful developer would, understanding structure before acting, operating within boundaries, never touching more than necessary instead of relying on broad, token-heavy file dumps. And AI chat interfaces need real codebase context without the developer manually copying files into the conversation.

## Core Concepts

Projexor is built on a strict and predictable model:

- **Single entry point**: everything goes through a project context
- **Root-bound operations**: all paths are relative and sandboxed
- **Fail-fast validation**: invalid inputs throw immediately
- **Tolerant batch processing**: partial success with collected errors

---

## Quick Start

All operations go through a project context created by `loadProject`.

```ts
import { loadProject, ProjectError, ErrorCode } from 'projexor';

const project = loadProject({
  path: '/my/project',
  ignore: ['node_modules', 'dist', '.git'],
});

// walk the project tree
const structure = await project.getStructure();

// parse single file (throws on failure)
const ast = await project.parseAst('src/auth.ts');

// parse multiple files (partial success)
const { results, errors } = await project.parseAst([
  'src/auth.ts',
  'src/user.ts',
]);

// read file
const content = await project.readFile({
  path: 'src/auth.ts',
  lines: { start: 1, end: 10 },
});

// write content to file. overwrite, insert, delete content
await project.writeFile({
  path: 'src/auth.ts',
  content: 'export const version = "2.0.0"\n',
  operation: 'overwrite',
  lines: { start: 1, end: 1 },
});

// run a command
const { stdout, stderr, output, exitCode } = await project.runCommand({
  command: 'npm',
  args: ['run', 'build'],
});
```

---

## Supported Languages

| Language   | Extensions                    |
| ---------- | ----------------------------- |
| TypeScript | `.ts`, `.tsx`                 |
| JavaScript | `.js`, `.mjs`, `.cjs`, `.jsx` |

Language is detected automatically from the file extension. Additional languages will be added as peer dependencies.

---

## Error Handling

All errors are instances of `ProjexorError` with a stable `code` field.

```ts
import { ProjectError, ErrorCode } from 'projexor';

try {
  const content = await project.readFile({ path: 'src/missing.ts' });
} catch (err) {
  if (err instanceof ProjectError) {
      if (err.code ErrorCode.FILE_NOT_FOUND) {
        // handle
      }
  }
}
```

---

## Known Limitations

- **Concurrent writes**: Concurrent writes to the same file produce unexpected results.

- **Stale positions after writes**: Any AST or line numbers obtained before a write are stale after it completes. Re-parse if you need accurate positions.

- **Streaming command output**: In buffered mode, all output accumulates in memory. For commands that produce large output, set `maxBuffer` or use `onOutput` for streaming mode.

- **Language support.** TypeScript and JavaScript only.

## Documentation

## Documentation

- [API Reference](docs/api.md)
- [Data Models](docs/models.md)
- [Error Handling](docs/errors.md)
- [Supported Languages](docs/languages.md)
- [Architecture](ARCHITECTURE.md)

---

## License

[MIT](./LICENSE)
