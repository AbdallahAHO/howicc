This directory stores release intent for the versioned HowiCC surfaces:

- `howicc`
- `@howicc/api`
- `@howicc/web`
- `@howicc/jobs`

Internal workspace packages stay private, and release changesets should normally target the deployable surfaces above.
Changesets still reads the full workspace graph so dependency validation stays correct.
When shared code changes, add the affected release surfaces to the changeset.
