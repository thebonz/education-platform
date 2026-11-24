-- HappyClass PostgreSQL 16: a single metadata-only JSON snapshot.
-- Used by ops/postgres-trend.py; never selects application records.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

WITH database_stats AS (
  SELECT xact_commit, xact_rollback, blks_hit, blks_read,
         deadlocks, temp_files, temp_bytes, stats_reset
  FROM pg_stat_database
  WHERE datname = current_database()
), connections AS (
  SELECT count(*) AS total,
         count(*) FILTER (WHERE state = 'active') AS active,
         count(*) FILTER (WHERE state LIKE 'idle in transaction%') AS idle_in_transaction,
         count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_for_lock
  FROM pg_stat_activity
  WHERE datname = current_database()
)
SELECT json_build_object(
  'schema_version', 1,
  'captured_at', to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'server_started_at', to_char(pg_postmaster_start_time() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'stats_reset', CASE WHEN d.stats_reset IS NULL THEN NULL
    ELSE to_char(d.stats_reset AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
  'database_oid', (SELECT oid::integer FROM pg_database WHERE datname = current_database()),
  'database_size_bytes', pg_database_size(current_database()),
  'max_connections', current_setting('max_connections')::integer,
  'autovacuum', current_setting('autovacuum') = 'on',
  'total_connections', c.total,
  'active_connections', c.active,
  'idle_in_transaction', c.idle_in_transaction,
  'waiting_for_lock', c.waiting_for_lock,
  'xact_commit', d.xact_commit,
  'xact_rollback', d.xact_rollback,
  'blks_hit', d.blks_hit,
  'blks_read', d.blks_read,
  'deadlocks', d.deadlocks,
  'temp_files', d.temp_files,
  'temp_bytes', d.temp_bytes
)
FROM database_stats d CROSS JOIN connections c;

COMMIT;
