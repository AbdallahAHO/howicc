---
'@howicc/api': patch
'@howicc/db': patch
---

Rebuild production D1 from a single migration baseline and re-point the API worker at the freshly provisioned database. The previous 0001–0009 chain had drifted out of sync with wrangler's migration tracker, causing `ALTER TABLE` statements to fail against the already-present schema.
