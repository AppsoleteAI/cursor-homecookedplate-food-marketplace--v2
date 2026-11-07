-- Read only. This does not change the database.
-- The SQL editor shows only the last result, so this file is one select.
-- polcmd: r = select, a = insert, w = update, d = delete, * = all.

select c.relname as table_name,
       p.polname as policy_name,
       p.polcmd as command,
       pg_get_expr(p.polqual, p.polrelid) as using_expression,
       pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_policy p
join pg_class c on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'orders'
order by p.polname;
