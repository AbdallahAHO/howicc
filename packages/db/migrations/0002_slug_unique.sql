-- Backfill: deduplicate any existing slug collisions before enforcing uniqueness.
-- For each duplicated slug, keep the oldest (by created_at, then id) as-is and
-- append "-" || substr(id, -6) to every other row so each slug is unique.
UPDATE conversations
SET slug = slug || '-' || substr(id, -6)
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      slug,
      ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn
    FROM conversations
  )
  WHERE rn > 1
);

CREATE UNIQUE INDEX conversations_slug_unique_idx
  ON conversations(slug);
