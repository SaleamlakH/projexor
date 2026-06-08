---
'@aimro/projexor': minor
---

Add `getStructure` for directory traversal

- Traverse a target path and return a `ProjectStructure` representation.
- Propagates `ProjexorError` with defined `ErrorCodes` when failures occur.
- All child paths are normalized to start from `targetPath`, ensuring consistent and predictable output.
