# Data Models (Types)

All types returned by or passed to Projexor operations. Every type listed here is exported from the package root.

**See also:** [API Reference](api.md) · [Error Handling](errors.md) · [Supported Languages](languages.md)

---

## Table of Contents

- [ProjectContext](#projectcontext)
- [ProjectStructure](#projectstructure)
- [FileNode](#filenode)
- [ASTResult](#astresult)
- [TSASTResult](#tsastresult)
- [Import and ImportedElement](#import-and-importedelement)
- [Exports](#exports)
- [Parameter](#parameter)
- [InternalFunction](#internalfunction)
- [FunctionNode](#functionnode)
- [Property](#property)
- [ClassNode](#classnode)
- [WriteResult](#writeresult)
- [CommandResult](#commandresult)

---

## ProjectContext

The plain object returned by [`loadProject`](api.md#loadproject). All operations are closures bound to the project root.

```ts
interface ProjectContext = {
  getStructure: (options?: GetStructureOptions) => Promise<ProjectStructure>;
  parseAst: {
    (path: string): Promise<ASTResult>;
    (
      paths: string[],
      options?: parseAstListOptions,
    ): Promise<{
      results: Record<string, ASTResult>;
      errors: Record<string, ProjexorError>;
    }>;
  };
  readFile: (options: ReadFileOptions) => Promise<string>;
  writeFile: (options: WriteFileOptions) => Promise<WriteResult>;
  runCommand: (options: RunCommandOptions) => Promise<CommandResult>;
};

interface GetStructureOptions {
  path?: string;
  ignore?: string[];
};

interface ParseAstListOptions {
  skipUnsupported?: boolean; // silently skip unsupported files — never in errors
  languages?: LanguageKey[]; // only process files matching these language keys
};

interface ReadFileOptions {
  path: string;
  lines?: {
    start: number; // 1-indexed, inclusive
    end?: number; // 1-indexed, inclusive — omit to read from start to end of file
  };
};

interface WriteFileOptions {
  path: string;
  content?: string; // required for overwrite and insert, not allowed for delete
  operation: 'overwrite' | 'insert' | 'delete';
  lines?: {
    start: number; // 1-indexed, inclusive
    end?: number; // 1-indexed, inclusive — omit to default to start
  };
  createIfNotExists?: boolean; // default false
};

interface RunCommandOptions {
  command: string;
  args: string[];
  cwd?: string; // relative to project root, defaults to '.'
  timeout?: number; // milliseconds
  maxBuffer?: number; // bytes, default 100MB — buffered mode only
  onOutput?: (chunk: string) => void; // streaming mode activates when provided
};
```

See [API Reference](api.md) for the full signature and behavior of each operation.

---

## ProjectStructure

Returned by [`getStructure`](api.md#getstructure).

```ts
interface ProjectStructure {
  absoluteRoot: string; // absolute path of the project root
  targetDir: string; // exactly what the caller passed, or '.' if nothing was passed
  tree: FileNode[];
}
```

`absoluteRoot` is the only place in the library where an absolute path appears in a return value. Every other path in return values is relative to the project root.

---

## FileNode

A single entry in the `tree` returned by [`getStructure`](api.md#getstructure). Directories contain their children recursively.

```ts
interface FileNode {
  name: string; // basename only e.g. 'auth.ts', 'utils'
  path: string; // relative to project root, starts with targetDir
  type: 'file' | 'directory';
  children: FileNode[]; // always [] for files
}
```

Every `FileNode.path` starts with the `targetDir` from the parent `ProjectStructure`.

---

## ASTResult

The union type returned by [`parseAst`](api.md#parseast). Discriminated by `language`. Grows as new languages are added.

```ts
type ASTResult = TSASTResult;
// future: | PythonASTResult | RustASTResult
```

Narrow by `language` to access language-specific fields:

```ts
const ast = await project.parseAst('src/auth.ts');

if (ast.language === 'ts' || ast.language === 'js') {
  ast.functions; // FunctionNode[]
  ast.classes; // ClassNode[]
}
```

All language result types share a common base:

```ts
interface BaseASTResult {
  language: LanguageKey; // discriminant
  path: string; // caller's input path — exactly as passed
  fileName: string; // basename only
  totalLines: number;
}
```

See [Supported Languages](languages.md) for the list of supported extensions and their language keys.

---

## TSASTResult

Returned for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, and `.cjs` files. As both are parsed by Typescript Compiler API TypeScript, they share this model. `language` reflects the actual language family, not the parser used internally.

```ts
type TSASTResult = BaseASTResult & {
  language: 'ts' | 'js';
  imports: Import[];
  exports: Exports;
  functions: FunctionNode[];
  classes: ClassNode[];
};
```

| Field        | Description                                                         |
| ------------ | ------------------------------------------------------------------- |
| `language`   | `'ts'` for `.ts`/`.tsx` — `'js'` for `.js`/`.jsx`/`.mjs`/`.cjs`     |
| `path`       | Caller's input path, exactly as passed                              |
| `fileName`   | Basename only — e.g. `'auth.ts'`                                    |
| `totalLines` | Total line count of the file                                        |
| `imports`    | All import statements — see [Import](#import-and-importedelement)   |
| `exports`    | All exports grouped by kind — see [Exports](#exports)               |
| `functions`  | Top-level function declarations — see [FunctionNode](#functionnode) |
| `classes`    | Top-level class declarations — see [ClassNode](#classnode)          |

---

## Import and ImportedElement

All import statements in a file, grouped by source module.

```ts
interface Import {
  source: string; // the module specifier e.g. 'fs', './utils', 'zod'
  startLine: number;
  endLine: number; // same as startLine for single-line imports
  elements: ImportedElement[];
}

interface ImportedElement {
  name: string;
  alias: string | null; // the 'as' alias name, if present
  line: number;
  isTypeImport: boolean; // true for 'import type { Foo }' or individual 'type' specifiers
}
```

---

## Exports

All exports in a file, grouped into three categories.

```ts
interface Exports {
  inline: InlineExport[];
  collected: CollectedExport[];
  reExports: ReExport[];
}
```

### InlineExport

A declaration that is exported directly at the point it is defined.

```ts
// export function foo() {}
// export class Bar {}
// export const x = 1

interface InlineExport {
  name: string;
  kind: 'function' | 'class' | 'variable';
  line: number;
}
```

### CollectedExport

A named export in an `export { }` statement that does not re-export from another module.

```ts
// export { foo, type Bar }

interface CollectedExport {
  name: string;
  alias: string | null; // the 'as' alias, if present
  isTypeExport: boolean;
  line: number;
}
```

### ReExport

An export that originates from another module.

```ts
// export { foo } from './other'
// export * from './other'
// export * as ns from './other'

interface ReExport {
  name: string; // '*' for 'export * from ...'
  alias: string | null; // the 'as' alias, if present
  source: string; // the source module specifier
  isTypeExport: boolean;
  line: number;
}
```

---

## Parameter

A function or constructor parameter. Used in [`FunctionNode`](#functionnode), [`InternalFunction`](#internalfunction), and [`ClassNode`](#classnode).

```ts
interface Parameter {
  name: string;
  type: string;
}
```

---

## InternalFunction

A function nested inside a top-level function or a method inside a class.

```ts
interface InternalFunction {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
  startLine: number;
  endLine: number;
}
```

Used as the type for `FunctionNode.internalFunctions` and `ClassNode.methods`.

---

## FunctionNode

A top-level function declaration in a file.

```ts
interface FunctionNode {
  name: string;
  parameters: Parameter[];
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
  startLine: number;
  endLine: number;
  internalFunctions: InternalFunction[]; // one level deep only
}
```

`internalFunctions` captures functions declared directly inside this function body. Nesting does not go deeper than one level.

---

## Property

A class property. Used in [`ClassNode`](#classnode).

```ts
interface Property {
  name: string;
  type: string;
  line: number;
  isConstructorParam: boolean; // true if declared via constructor parameter shorthand
}
```

Constructor parameter shorthands (e.g. `constructor(private name: string)`) appear in both `properties` with `isConstructorParam: true` and in `constructor.parameters`.

---

## ClassNode

A top-level class declaration in a file.

```ts
interface ClassNode {
  name: string;
  isExported: boolean;
  startLine: number;
  endLine: number;
  properties: Property[];
  constructor: {
    parameters: Parameter[];
    startLine: number;
    endLine: number;
  } | null;
  methods: InternalFunction[];
}
```

`constructor` is `null` if the class has no explicit constructor. `methods` uses the same [`InternalFunction`](#internalfunction) model as nested functions inside `FunctionNode`.

---

## WriteResult

Returned by [`writeFile`](api.md#writefile).

```ts
interface WriteResult {
  linesWritten: { start: number; end: number }; // the range that was affected
  lineDelta: number; // positive = lines added, negative = lines removed
  totalLines: number; // new total line count after write
}
```

`lineDelta` by operation:

| Operation   | `lineDelta`                                                     |
| ----------- | --------------------------------------------------------------- |
| `overwrite` | `newLines - replacedLines` — can be positive, negative, or zero |
| `insert`    | always positive — number of lines inserted                      |
| `delete`    | always negative — `-(end - start + 1)`                          |

Use `lineDelta` to adjust line numbers recorded before the write.

---

## CommandResult

Returned by [`runCommand`](api.md#runcommand).

```ts
interface CommandResult {
  stdout: string; // stdout only
  stderr: string; // stderr only
  output: string; // stdout and stderr interleaved in true write order
  exitCode: number;
}
```

`output` is the same as watching the command run in a terminal. stdout and stderr merged in the order they were written.
