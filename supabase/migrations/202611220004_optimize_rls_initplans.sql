-- Wrap auth helper calls in scalar subqueries so PostgreSQL evaluates them
-- once per statement instead of once per row. Preserve already-wrapped calls.
DO $$
DECLARE
  p record;
  role_list text;
  using_expr text;
  check_expr text;
  using_clause text;
  check_clause text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~* 'auth\.(uid|role|jwt|email)\(\)'
        OR coalesce(with_check, '') ~* 'auth\.(uid|role|jwt|email)\(\)'
      )
  LOOP
    SELECT string_agg(
      CASE WHEN r.role_name = 'public' THEN 'PUBLIC' ELSE quote_ident(r.role_name) END,
      ', '
    )
    INTO role_list
    FROM unnest(p.roles) AS r(role_name);

    using_expr := p.qual;
    check_expr := p.with_check;

    IF using_expr IS NOT NULL THEN
      using_expr := replace(using_expr, 'private.is_conversation_participant(conversation_id)', 'private.is_conversation_participant(conversation_id, auth.uid())');
      using_expr := regexp_replace(using_expr, 'SELECT[[:space:]]+auth\.uid\(\)', '__AUTH_UID_SELECT__', 'gi');
      using_expr := regexp_replace(using_expr, 'auth\.uid\(\)', '(SELECT auth.uid())', 'gi');
      using_expr := replace(using_expr, '__AUTH_UID_SELECT__', 'SELECT auth.uid()');
      using_expr := regexp_replace(using_expr, 'SELECT[[:space:]]+auth\.role\(\)', '__AUTH_ROLE_SELECT__', 'gi');
      using_expr := regexp_replace(using_expr, 'auth\.role\(\)', '(SELECT auth.role())', 'gi');
      using_expr := replace(using_expr, '__AUTH_ROLE_SELECT__', 'SELECT auth.role()');
      using_expr := regexp_replace(using_expr, 'SELECT[[:space:]]+auth\.jwt\(\)', '__AUTH_JWT_SELECT__', 'gi');
      using_expr := regexp_replace(using_expr, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'gi');
      using_expr := replace(using_expr, '__AUTH_JWT_SELECT__', 'SELECT auth.jwt()');
      using_expr := regexp_replace(using_expr, 'SELECT[[:space:]]+auth\.email\(\)', '__AUTH_EMAIL_SELECT__', 'gi');
      using_expr := regexp_replace(using_expr, 'auth\.email\(\)', '(SELECT auth.email())', 'gi');
      using_expr := replace(using_expr, '__AUTH_EMAIL_SELECT__', 'SELECT auth.email()');
    END IF;

    IF check_expr IS NOT NULL THEN
      check_expr := replace(check_expr, 'private.is_conversation_participant(conversation_id)', 'private.is_conversation_participant(conversation_id, auth.uid())');
      check_expr := regexp_replace(check_expr, 'SELECT[[:space:]]+auth\.uid\(\)', '__AUTH_UID_SELECT__', 'gi');
      check_expr := regexp_replace(check_expr, 'auth\.uid\(\)', '(SELECT auth.uid())', 'gi');
      check_expr := replace(check_expr, '__AUTH_UID_SELECT__', 'SELECT auth.uid()');
      check_expr := regexp_replace(check_expr, 'SELECT[[:space:]]+auth\.role\(\)', '__AUTH_ROLE_SELECT__', 'gi');
      check_expr := regexp_replace(check_expr, 'auth\.role\(\)', '(SELECT auth.role())', 'gi');
      check_expr := replace(check_expr, '__AUTH_ROLE_SELECT__', 'SELECT auth.role()');
      check_expr := regexp_replace(check_expr, 'SELECT[[:space:]]+auth\.jwt\(\)', '__AUTH_JWT_SELECT__', 'gi');
      check_expr := regexp_replace(check_expr, 'auth\.jwt\(\)', '(SELECT auth.jwt())', 'gi');
      check_expr := replace(check_expr, '__AUTH_JWT_SELECT__', 'SELECT auth.jwt()');
      check_expr := regexp_replace(check_expr, 'SELECT[[:space:]]+auth\.email\(\)', '__AUTH_EMAIL_SELECT__', 'gi');
      check_expr := regexp_replace(check_expr, 'auth\.email\(\)', '(SELECT auth.email())', 'gi');
      check_expr := replace(check_expr, '__AUTH_EMAIL_SELECT__', 'SELECT auth.email()');
    END IF;

    using_clause := CASE WHEN using_expr IS NULL THEN '' ELSE ' USING (' || using_expr || ')' END;
    check_clause := CASE WHEN check_expr IS NULL THEN '' ELSE ' WITH CHECK (' || check_expr || ')' END;

    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd,
      role_list, using_clause, check_clause
    );
  END LOOP;
END $$;
