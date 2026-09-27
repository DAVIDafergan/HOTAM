SELECT tablename, policyname, cmd,
       COALESCE(qual, '') AS using_expr,
       COALESCE(with_check, '') AS check_expr
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('admins', 'chats', 'messages', 'reports', 'reviews', 'supermarket_reviews')
ORDER BY tablename, cmd, policyname;
