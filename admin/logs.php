<?php
// api/admin/logs.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

// Check if activity_logs table exists, fallback to troubleshooting_logs
$tables = $conn->query("SHOW TABLES LIKE 'activity_logs'")->num_rows;

if ($tables > 0) {
    $rows = $conn->query("
        SELECT l.id, l.action, l.details, l.created_at,
               COALESCE(u.name, 'System') AS user_name
        FROM activity_logs l
        LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.created_at DESC
        LIMIT 200
    ")->fetch_all(MYSQLI_ASSOC);
} else {
    // Fallback: show attendance deletions as activity
    $rows = $conn->query("
        SELECT a.id,
               CONCAT('Attendance Record - ', a.status) AS action,
               CONCAT(a.student_name, ' (', a.index_number, ') ', a.lecture_name) AS details,
               a.deleted_at AS created_at,
               u.name AS user_name
        FROM attendance a
        LEFT JOIN users u ON u.id = a.deleted_by
        WHERE a.deleted_at IS NOT NULL
        ORDER BY a.deleted_at DESC
        LIMIT 200
    ")->fetch_all(MYSQLI_ASSOC);
}

json_ok(['logs' => $rows]);
