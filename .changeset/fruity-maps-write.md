---
'@aimro/projexor': minor
---

- Introduce typescript and javascript AST parser with unified `parseAst` API
- fix: replace an early `return` with a `continue` statement within the `serializeVariableStatement` loop. This ensures that encountering a function initializer does not abort processing.
- test: updated the path handling across both JavaScript and TypeScript test suites to use OS-independent `path.join` checks instead of hardcoded forward-slashes (`/`), preventing potential test failures on Windows environments.
