# Error Handling

**See also:** [API Reference](api.md) · [Data Models](models.md)

---

## ProjexorError

All errors thrown by Projexor are instances of `ProjexorError`, which extends the native `Error` class.

```ts
class ProjexorError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown; // original OS or parser error, when available

  constructor(code: ErrorCode, message: string, cause?: unknown);
}
```

---

## Catching errors

```ts
import { ProjexorError, ErrorCode } from 'projexor';

try {
  const content = await project.readFile({ path: 'src/missing.ts' });
} catch (err) {
  if (err instanceof ProjexorError) {
    switch (err.code) {
      case ErrorCode.FILE_NOT_FOUND:
        // handle missing file
        break;
      case ErrorCode.PATH_OUTSIDE_ROOT:
        // handle path escape attempt
        break;
      default:
        throw err;
    }
  }
}
```

---

## cause

When a `ProjexorError` wraps an underlying error, the original is on `err.cause`.

```ts
if (err.code === ErrorCode.COMMAND_TIMEOUT) {
  const partial = err.cause.all; // output written before the process was killed
}
```

---

## Error codes

`ErrorCode` is exported as both a value and a type:

```ts
import { ErrorCode } from 'projexor'; // value
import type { ErrorCode } from 'projexor'; // type
```

---

| Code                   | Thrown by                                                                                                     | When                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `INVALID_PATH`         | [`loadProject`](api.md#loadproject)                                                                           | Root path is not absolute                                                    |
| `DIRECTORY_NOT_FOUND`  | [`loadProject`](api.md#loadproject), [`getStructure`](api.md#getstructure), [`runCommand`](api.md#runcommand) | Directory does not exist                                                     |
| `NOT_A_DIRECTORY`      | [`loadProject`](api.md#loadproject), [`getStructure`](api.md#getstructure)                                    | Path exists but is a file, not a directory                                   |
| `NOT_A_FILE`           | [`readFile`](api.md#readfile), [`writeFile`](api.md#writefile)                                                | Path exists but is a directory, not a file                                   |
| `FILE_NOT_FOUND`       | [`readFile`](api.md#readfile), [`writeFile`](api.md#writefile), [`parseAst`](api.md#parseast)                 | File does not exist                                                          |
| `PATH_OUTSIDE_ROOT`    | all operations                                                                                                | Resolved path escapes the project root                                       |
| `PARSE_FAILED`         | [`parseAst`](api.md#parseast)                                                                                 | Compiler could not parse the file                                            |
| `PARSER_NOT_INSTALLED` | [`parseAst`](api.md#parseast)                                                                                 | Extension is supported but the `typescript` peer dependency is not installed |
| `UNSUPPORTED_LANGUAGE` | [`parseAst`](api.md#parseast)                                                                                 | File extension has no registered parser                                      |
| `COMMAND_TIMEOUT`      | [`runCommand`](api.md#runcommand)                                                                             | Process exceeded the optional `timeout`                                      |
| `PERMISSION_DENIED`    | [`readFile`](api.md#readfile), [`writeFile`](api.md#writefile), [`getStructure`](api.md#getstructure)         | File system permission error                                                 |
| `INVALID_RANGE`        | [`readFile`](api.md#readfile), [`writeFile`](api.md#writefile)                                                | Line range is out of bounds or malformed                                     |
| `INVALID_OPERATION`    | [`writeFile`](api.md#writefile)                                                                               | `insert` or `delete` with `createIfNotExists` on a non-existent file         |

---

## Per-operation error codes

### [loadProject](api.md#loadProject)

| Code                  | When                        |
| --------------------- | --------------------------- |
| `INVALID_PATH`        | `path` is not absolute      |
| `DIRECTORY_NOT_FOUND` | `path` does not exist       |
| `NOT_A_DIRECTORY`     | `path` exists but is a file |

### [getStructure](api.md#getstructure)

| Code                  | When                                      |
| --------------------- | ----------------------------------------- |
| `PATH_OUTSIDE_ROOT`   | Queried path escapes the root             |
| `DIRECTORY_NOT_FOUND` | Queried path does not exist               |
| `NOT_A_DIRECTORY`     | Queried path is a file                    |
| `PERMISSION_DENIED`   | fs permission error during directory walk |

### [parseAst](api.md#parseast)

| Code                   | Behavior                                                    |
| ---------------------- | ----------------------------------------------------------- |
| `PATH_OUTSIDE_ROOT`    | Always throws — pre-flight for list inputs                  |
| `FILE_NOT_FOUND`       | Always throws — pre-flight for list inputs                  |
| `UNSUPPORTED_LANGUAGE` | Throws for single file — goes into `errors` for list inputs |
| `PARSER_NOT_INSTALLED` | Throws for single file — goes into `errors` for list inputs |
| `PARSE_FAILED`         | Throws for single file — goes into `errors` for list inputs |

### [readFile](api.md#readfile)

| Code                | When                                                      |
| ------------------- | --------------------------------------------------------- |
| `PATH_OUTSIDE_ROOT` | Path escapes the root                                     |
| `FILE_NOT_FOUND`    | File does not exist                                       |
| `NOT_A_FILE`        | Path is a directory                                       |
| `PERMISSION_DENIED` | fs permission error                                       |
| `INVALID_RANGE`     | `start < 1`, `end < start`, or `start` beyond total lines |

### [writeFile](api.md#writefile)

| Code                | When                                                               |
| ------------------- | ------------------------------------------------------------------ |
| `PATH_OUTSIDE_ROOT` | Path escapes the root                                              |
| `FILE_NOT_FOUND`    | File does not exist and `createIfNotExists` is false               |
| `NOT_A_FILE`        | Path is a directory                                                |
| `PERMISSION_DENIED` | fs permission error                                                |
| `INVALID_RANGE`     | `start < 1` or `end < start`                                       |
| `INVALID_OPERATION` | `insert` or `delete` with `createIfNotExists` on non-existent file |

### [runCommand](api.md#runcommand)

| Code                  | When                       |
| --------------------- | -------------------------- |
| `PATH_OUTSIDE_ROOT`   | `cwd` escapes the root     |
| `DIRECTORY_NOT_FOUND` | `cwd` does not exist       |
| `COMMAND_TIMEOUT`     | Process exceeded `timeout` |

---
