-- PREPARED ONLY; never executed by the static acceptance entry point.
-- Explicit stage selection is this stage-29 suite plus the required
-- stage29_disposable_authorized and expected_system_identifier variables.
-- Use ONLY a separately approved, independently verified NEW EMPTY target.
-- No default connection, runtime provisioning, migration or cleanup command.
-- Each historical payload is preceded by exact stage-29 metadata checks.
\set ON_ERROR_STOP on

\ir ros03c-stage29-preflight.sql
\set a01_candidate_authorized 1
\ir ros03c-a01-guarded-writes-regression.sql

\ir ros03c-stage29-preflight.sql
\set finding4_disposable_authorized 1
\ir ros03c-finding4-regression.sql

\ir ros03c-stage29-preflight.sql
\set finding5_disposable_authorized 1
\ir ros03c-finding5-regression.sql

\ir ros03c-stage29-preflight.sql
\set finding8_fence_disposable_authorized 1
\ir ros03c-finding8-fence-regression.sql

\ir ros03c-stage29-preflight.sql
\set finding9_disposable_authorized 1
\ir ros03c-finding9-regression.sql

\ir ros03c-stage29-preflight.sql
\set finding11_disposable_authorized 1
\ir ros03c-finding11-regression.sql

\echo Stage-29 sequential payloads completed; concurrency, HTTP and historical-data replay are separate gates.
