---
'howicc': minor
---

- Sanitize privacy findings during sync by default so sensitive sessions can still upload with explicit placeholders instead of failing the whole run.
- Add `howicc sync --privacy strict` for the old block-and-review behavior when you want manual privacy approval.
- Speed up sync planning by avoiding eager revision hashing before session selection and improve preview output to show the upload-safe sanitized payload.
