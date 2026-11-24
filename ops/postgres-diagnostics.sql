-- HappyClass PostgreSQL 16 diagnostics: metadata only, no application data.
-- Transaction READ ONLY guarantees these queries cannot change the database.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';
SET LOCAL idle_in_transaction_session_timeout = '10s';

\echo '==> Database and connection capacity'
SELECT
  current_database() AS database,
  pg_size_pretty(pg_database_size(current_database())) AS database_size,
  current_setting('max_connections') AS max_connections,
  current_setting('shared_buffers') AS shared_buffers,
  current_setting('work_mem') AS work_mem,
  current_setting('autovacuum') AS autovacuum;

\echo '==> Connection counts (current database only)'
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state LIKE 'idle in transaction%') AS idle_in_transaction,
  count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_for_lock
FROM pg_stat_activity
WHERE datname = current_database();

\echo '==> Database counters since last stats reset (not instantaneous rates)'
SELECT
  datname,
  xact_commit,
  xact_rollback,
  CASE WHEN blks_hit + blks_read > 0
    THEN round(100.0 * blks_hit / (blks_hit + blks_read), 2)
    ELSE NULL END AS cache_hit_pct,
  deadlocks,
  temp_files,
  pg_size_pretty(temp_bytes) AS temp_bytes,
  stats_reset
FROM pg_stat_database
WHERE datname = current_database();

\echo '==> Largest 10 tables including indexes (estimates, no row contents)'
SELECT
  schemaname,
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
  n_live_tup AS estimated_live_rows,
  n_dead_tup AS estimated_dead_rows
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 10;

\echo '==> Top 10 estimated dead-tuple counts (autovacuum monitoring)'
SELECT
  schemaname,
  relname,
  n_live_tup AS estimated_live_rows,
  n_dead_tup AS estimated_dead_rows,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;

COMMIT;
