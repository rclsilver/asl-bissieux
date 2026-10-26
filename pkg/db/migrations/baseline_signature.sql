SELECT entry FROM (
  SELECT 'table:' || rel.relname || ':' || rel.relrowsecurity::text || ':' || rel.relforcerowsecurity::text AS entry
  FROM pg_class rel JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public' AND rel.relkind = 'r'
    AND rel.relname IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user')
  UNION ALL
  SELECT 'column:' || table_name || ':' || column_name || ':' || jsonb_build_object(
    'type', udt_name, 'nullable', is_nullable, 'default', column_default,
    'position', ordinal_position, 'length', character_maximum_length,
    'precision', numeric_precision, 'scale', numeric_scale,
    'identity', is_identity, 'generated', is_generated, 'expression', generation_expression
  )::text AS entry
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user')
  UNION ALL
  SELECT 'constraint:' || rel.relname || ':' || con.conname || ':' || pg_get_constraintdef(con.oid, false)
  FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public'
    -- PostgreSQL 18 also represents NOT NULL in pg_constraint. Nullability is
    -- already compared above, including on older PostgreSQL versions.
    AND con.contype <> 'n'
    AND rel.relname IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user')
  UNION ALL
  SELECT 'index:' || tablename || ':' || indexname || ':' || indexdef
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user')
  UNION ALL
  SELECT 'trigger:' || rel.relname || ':' || pg_get_triggerdef(trig.oid, false)
  FROM pg_trigger trig JOIN pg_class rel ON rel.oid = trig.tgrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public' AND NOT trig.tgisinternal
    AND rel.relname IN ('attachment','budget','cotisation','email','email_campaign','email_template','expense','member','member_unit','payment','unit','user')
) signature ORDER BY entry;
