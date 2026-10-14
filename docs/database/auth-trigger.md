# Supabase authentication trigger

## Purpose

Relationship OS creates a corresponding row in `public.profiles` when a new user is registered through Supabase Auth.

## Existing trigger

The following trigger exists on `auth.users` in the shared development Supabase project:

```sql
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();
```

The function `public.handle_new_user()` is included in `supabase/schema-snapshots/current_schema.sql`.

## Important

The schema snapshot was generated with `--schema public,private`. Consequently, the trigger on `auth.users` is not included in that snapshot.

When configuring a fresh Supabase project in the future, verify that this trigger is present. If it is absent, install it through a reviewed migration that references `public.handle_new_user()`.

Do not run this trigger definition against the existing development database because the trigger already exists.

## Verification

Run this read-only query in Supabase SQL Editor:

```sql
SELECT
  t.tgname,
  pg_get_triggerdef(t.oid)
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal;
```

Expected trigger: `on_auth_user_created`.
