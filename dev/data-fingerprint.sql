-- Content fingerprints only: no member details or message bodies are printed.
-- Run with psql -X -A -t for stable output before/after a migration or restore.
SELECT format(
  'SELECT %L AS table_name, count(*) AS rows, md5(COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text)::text, ''[]'')) AS fingerprint FROM public.%I t;',
  tablename, tablename)
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user')
ORDER BY tablename
\gexec
