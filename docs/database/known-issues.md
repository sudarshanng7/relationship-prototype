# Database — Known Issues

## DB-01: Supabase CLI remote connection timeout

**Status:** Open — non-blocking for local development  
**Date identified:** 14 October 2026  
**Priority:** Resolve before the next remote database migration

### Description

The Supabase CLI cannot connect from WSL to the hosted PostgreSQL database through the Supabase connection pooler.

Error:

```
failed to connect as temp role:
failed to connect to postgres:
Connection timed out
```

### Diagnostics performed

- DNS lookup for `aws-1-eu-west-1.pooler.supabase.com` succeeded.
- TCP connections to port 5432 timed out.
- TCP connections to port 6543 timed out.
- Tests on an alternative network also timed out.
- The hosted Supabase SQL Editor remained accessible.

The exact cause has not been established.

### Current database state

- `20261001000000_initial_schema` — recorded remotely.
- `20261013210000_secure_couple_invite_acceptance` — recorded remotely.
- Both migrations applied successfully to the local Supabase database.
- The initial migration was registered manually through SQL Editor because the CLI connection failed.
- No hosted application tables were modified during migration-history reconciliation.

### Impact

Local Supabase development can continue.

CLI-based remote migration checks and deployments are blocked until PostgreSQL connectivity is restored.

### Follow-up

1. Check Supabase project health and database network restrictions.
2. Check whether the CLI connection works again.
3. Verify migration history using `supabase migration list --linked`.
4. Compare the remote schema with the version-controlled schema.
5. Test `supabase db push --linked --dry-run` before applying any new migration.
6. If the timeout persists, investigate Supabase project connection settings and contact Supabase support with sanitized connection diagnostics.

Do not run `supabase db reset --linked` against the shared database.
