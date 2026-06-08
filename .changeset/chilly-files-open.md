---
'@aimro/projexor': minor
---

Add core types, error model, and result utilities

- Introduce the `ProjectStructure` model with `basePath` and `targetPath`, clearly separating the project root from the queried location.
- Add a unified error system using `ErrorCodes` and a single `ProjexorError`, providing consistent and predictable error handling.
- Provide result utilities to standardize how operations return data and errors.
