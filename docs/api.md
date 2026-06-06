# API Reference

All operations go through a `ProjectContext` returned by [`loadProject`](#loadproject). There are no standalone functions.

**See also:** [Data Models](models.md) · [Error Handling](errors.md) · [Supported Languages](languages.md)

---

## Table of Contents

- [loadProject](#loadproject)
- [getStructure](#getstructure)
- [parseAst](#parseast)
- [readFile](#readfile)
- [writeFile](#writefile)
- [runCommand](#runcommand)
- [Exports](#exports)

## `loadProject`

Sets the project root and returns a [`ProjectContext`](models.md#projectcontext) a plain object with all operations bound to that root. Synchronous. Validates, resolves, and returns immediately.

```ts
const project = loadProject(
  path: string,  // absolute path to project root
  {
    ignore?: string[] // glob patterns applied to all operations
    parserOptions?: {
        ts?: ts.CompilerOptions // ts/js
    }
  }
)
```

**Examples**

```ts
const project = loadProject({
  path: '/my/project/',
  ignore: ['node_modules', 'dist', '**/*.test.ts'],
});
```

**Throws:**

Throws immediately if `path` does not exist, not absolute, and is not a directory. see [Error Codes](errors.md#loadproject).

---

## `getStructure`

```ts
const structure = await project.getStructure({ path?: string, ignore?: string[] })
```

Walks a directory recursively and returns [`ProjectStructure`](models.md#projectstructure), a JSON file tree. Respects the global `ignore` list set by `loadProject`. When `path` is omitted, walks the entire project.

```ts
// entire project
const structure = await project.getStructure();

// subdirectory
const structure = await project.getStructure({ path: 'src' });

structure.absoluteRoot; // '/workspace/myapp'
structure.queriedPath; // 'src'
structure.tree; // FileNode[]
```

**Throws:**

Throw if the path is not found, a file, outside the project root, and permission denied. see [Error Codes](errors.md#getstructure).

**Example**

```ts
const structure = await project.getStructure({ path: 'src' });

structure.absoluteRoot; // '/workspace/myapp' — for debugging
structure.targetPath; // 'src'
structure.tree; // FileNode[]
```

---

## `parseAst`

Parses one or more files and returns their [AstResult](models.md#astresult). Language is detected automatically from the file extension.

Two overloads with different error behavior:

```ts
// Single file (throws on any error)
const ast = await project.parseAst(path: string)

// list of files (pre-flight throws, parse failures go to errors)
const { results, errors } = await project.parseAst(paths: string[], options: {
  skipUnsupported: boolean, // silently skip unsupported extensions
  languages: ['ts'], // only process files with language key 'ts' (.ts, .tsx)
})
```

Single file returns [AstResult](models.md#astresult);

List of Files result return type is:

`{ results: Record<string, ASTResult>, errors: Record<string, ProjexorError> }`

Narrow by `language` to get full type information. See [Data Models](models.md#astresult) for the full type hierarchy and [Supported Languages](languages.md) for the list of supported extensions.

**Examples**

```ts
// single file
const ast = await project.parseAst('src/auth.ts');

if (ast.language === 'ts' || ast.language === 'js') {
  ast.functions; // functions with name, params, return type, line positions
  ast.classes; // classes with properties, constructor, methods
  ast.imports; // imports grouped by source
  ast.exports; // inline, collected, and re-exports
}

// list of files
const { results, errors } = await project.parseAst([
  'src/auth.ts',
  'src/user.ts',
]);

for (const [file, ast] of Object.entries(results)) {
  // work on ast result
}

for (const [file, error] of Object.entries(errors)) {
  console.error(file, error.code, error.message);
}
```

**Throws / records:**
Single file operation throws on any error. List of files parsing validates all paths before parsing begins. If any path is missing or outside the root, the entire call throws. Parse failures for individual files go into `errors`. see [Error Codes](errors.md#parseast).

---

## `readFile`

Reads a file and returns its text content. Can return the whole file or a specific line range.

```ts
const content = await project.readFile({
  path: string,
  lines?: { start: number, end?: number }  // 1-indexed, inclusive
})
```

**Throws:**
Throw errors on file not found, permission denied, invalid line range, and file path outside the root set by `loadProject`. see [Error Codes](#readfile).

**Examples**

```ts
// whole file
const content = await project.readFile({ path: 'src/auth.ts' });

// line range
const content = await project.readFile({
  path: 'src/auth.ts',
  lines: { start: 14, end: 28 },
});

// from line 10 to end of file
const content = await project.readFile({
  path: 'src/auth.ts',
  lines: { start: 10 },
});
```

Returns raw content. The typical workflow is `parseAst` first to get line positions, then `readFile` with those positions.

---

## `writeFile`

Writes to an existing file. Three operations: `overwrite`, `insert`, `delete`.

> Writes are atomic, the file is either fully written or untouched if the process crashes mid-write.

```ts
const result = await project.writeFile({
  path: string,
  content?: string,
  operation: 'overwrite' | 'insert' | 'delete',
  lines?: { start: number, end?: number },  // 1-indexed, inclusive
  createIfNotExists?: boolean               // default false
})
```

**Parameters**
| Operation | `content` | Behavior |
| ----------- | --------- | ---------------------------------------------- |
| `overwrite` | required | replace lines `start–end` with content |
| `insert` | required | inject content before `start`, push lines down |
| `delete` | not used | remove lines `start–end` |

`end` defaults to `start` when omitted, single line. Omitting `lines` entirely replaces the whole file (`overwrite` only).

The number of lines in `content` does not need to match the number of lines replaced. You can replace 5 lines with 1, or 1 line with 10.

**Returns:** [`WriteResult`](models.md#writeresult)

**Throws:**
Throws if file not found, path outside the root, permission denied, invalid line range. see list of [Error Codes](errors.md#writefile).

**Handling line shifts**

Any AST obtained before the write is also stale. Re-parse if you need accurate positions after writing or use `lineDelta` to adjust.

**Examples**

```ts
// overwrite a line range
const result = await project.writeFile({
  path: 'src/auth.ts',
  content: '  return verified\n',
  operation: 'overwrite',
  lines: { start: 22, end: 22 },
});
// result.linesWritten → { start: 22, end: 22 }
// result.lineDelta    → +1  (replaced 1 line with 2)
// result.totalLines   → 85

// insert before line 10
const result = await project.writeFile({
  path: 'src/auth.ts',
  content: '// added comment\n',
  operation: 'insert',
  lines: { start: 10 },
});

// delete lines 10–15
const result = await project.writeFile({
  path: 'src/auth.ts',
  operation: 'delete',
  lines: { start: 10, end: 15 },
});

// replace entire file
const result = await project.writeFile({
  path: 'src/config.ts',
  content: 'export const debug = false\n',
  operation: 'overwrite',
});
// result.lineDelta   → -47  (if file had 48 lines, now has 1)
// result.totalLines  → 1
```

## `runCommand`

Executes a command and returns its output.

```ts
const result = await project.runCommand({
  command: string,
  args: string[],
  cwd?: string,           // relative to project root, defaults to '.'
  timeout?: number,       // milliseconds
  maxBuffer?: number,     // bytes, default 100MB
  onOutput?: (chunk: string) => void  // streaming mode when provided
})
```

Shell interpolation is never used (`shell: false`). Pass arguments as discrete array entries, not as a single shell string.

**Streaming**, onOutput callback provided. Chunks arrive in real time as the process writes them. Still returns full [`CommandResult`](models.md#commandresult) after exit. Suitable for long-running commands, AI integrations, and real-time display.

**Examples**

```ts
// buffered — output returned after process exits
const { stdout, stderr, output, exitCode } = await project.runCommand({
  command: 'npm',
  args: ['run', 'build'],
  timeout: 60000,
});

// streaming — chunks arrive in real time
const result = await project.runCommand({
  command: 'npm',
  args: ['test'],
  onOutput: (chunk) => {
    process.stdout.write(chunk); // or pipe to AI, websocket, etc
  },
});
// result still has full stdout, stderr, output, exitCode after exit
```

`output` is stdout and stderr interleaved in the order they were written in the terminal. It is the same as watching the command run in a terminal.

**Throws**

Only throws on command time out. see [Error Codes](errors.md#runcommand)

```ts
const result = await project.runCommand({ command: 'npm', args: ['test'] });

if (result.exitCode !== 0) {
  console.error('tests failed\n', result.output);
}
```

## Exports

```ts
// values
import { loadProject, ProjexorError, ErrorCode } from '@aimro/projexor';

// types
import type {
  // context and options
  ProjectContext,
  LoadProjectOptions,
  parseAstListOptions,
  ReadFileOptions,
  WriteFileOptions,
  RunCommandOptions,

  // structure
  ProjectStructure,
  FileNode,

  // ast
  ASTResult,
  TSASTResult,
  FunctionNode,
  InternalFunction,
  ClassNode,
  Property,
  Parameter,
  Import,
  ImportedElement,
  Exports,
  InlineExport,
  CollectedExport,
  ReExport,

  // results
  WriteResult,
  CommandResult,

  // errors
  ErrorCode,
} from '@aimro/projexor';
```
