-- HappyClass pre-launch audit: aggregate-only, no PII, never selects user/game rows.
-- Fixed queries; run as one transaction with read-only enforcement.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '8s';
SELECT json_build_object(
    'schema_version', 1,
    'games_total', (SELECT COUNT(*) FROM games),
    'games_published', (SELECT COUNT(*) FROM games WHERE is_published),
    'games_pending_review', (SELECT COUNT(*) FROM games WHERE review_status::text = 'PENDING'),
    'games_changes_requested', (SELECT COUNT(*) FROM games WHERE review_status::text = 'CHANGES_REQUESTED'),
    'games_approved', (SELECT COUNT(*) FROM games WHERE review_status::text = 'APPROVED'),
    'published_not_approved', (
        SELECT COUNT(*) FROM games WHERE is_published AND review_status::text <> 'APPROVED'
    ),
    'published_without_published_version', (
        SELECT COUNT(*) FROM games g
        WHERE g.is_published AND NOT EXISTS (
            SELECT 1 FROM game_versions v
            WHERE v.game_id = g.id AND v.is_published
        )
    ),
    'users_total', (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL),
    'users_active', (
        SELECT COUNT(*) FROM users
        WHERE deleted_at IS NULL AND is_active
    ),
    'users_inactive', (
        SELECT COUNT(*) FROM users
        WHERE deleted_at IS NULL AND NOT is_active
    ),
    'active_super_admins', (
        SELECT COUNT(DISTINCT u.id)
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.deleted_at IS NULL AND u.is_active AND r.key = 'super_admin'
    ),
    'active_content_reviewers', (
        SELECT COUNT(DISTINCT u.id)
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.deleted_at IS NULL AND u.is_active AND r.key = 'content_reviewer'
    ),
    'staff_role_assignments', (
        SELECT COUNT(*)
        FROM users u
        JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON ur.role_id = r.id
        WHERE u.deleted_at IS NULL AND r.key IN (
            'super_admin', 'support', 'content_editor', 'content_reviewer',
            'product_manager', 'accountant', 'school_admin'
        )
    )
);
COMMIT;
