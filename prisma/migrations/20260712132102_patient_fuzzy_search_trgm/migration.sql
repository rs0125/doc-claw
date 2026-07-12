-- Trigram fuzzy matching for patient names (typo / transliteration tolerant).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index accelerates similarity() / ILIKE lookups on name.
CREATE INDEX IF NOT EXISTS "Patient_name_trgm_idx" ON "Patient" USING gin ("name" gin_trgm_ops);