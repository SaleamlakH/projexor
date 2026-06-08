# @aimro/projexor

## 0.1.0

### Minor Changes

- f526a95: Add core types, error model, and result utilities
  - Introduce the `ProjectStructure` model with `basePath` and `targetPath`, clearly separating the project root from the queried location.
  - Add a unified error system using `ErrorCodes` and a single `ProjexorError`, providing consistent and predictable error handling.
  - Provide result utilities to standardize how operations return data and errors.

- bb4b44c: Add `getStructure` for directory traversal
  - Traverse a target path and return a `ProjectStructure` representation.
  - Propagates `ProjexorError` with defined `ErrorCodes` when failures occur.
  - All child paths are normalized to start from `targetPath`, ensuring consistent and predictable output.

- 510f9b5: - Introduce typescript and javascript AST parser with unified `parseAst` API
  - fix: replace an early `return` with a `continue` statement within the `serializeVariableStatement` loop. This ensures that encountering a function initializer does not abort processing.
  - test: updated the path handling across both JavaScript and TypeScript test suites to use OS-independent `path.join` checks instead of hardcoded forward-slashes (`/`), preventing potential test failures on Windows environments.
  - fix: use `path.basename` and `path.extname` in `parseAst.ts` to correctly handle extension-less files and paths with dotted directories.

### Patch Changes

- 32955ba: Configure package for initial npm publishing
