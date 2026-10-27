<?php
// api/admin/logs.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$rows = $conn->query("
    SELECT l.*, COALESCE(u.name, a.name, CONCAT('User #', l.user_id)) AS name
    FROM login_logs l
    LEFT JOIN users u ON u.id = l.user_id AND l.role = 'classrep'
    LEFT JOIN admins a ON a.id = l.user_id AND l.role = 'admin'
    ORDER BY l.id DESC
    LIMIT 200
");

if (!$rows) {
    json_error("Database Error: " . $conn->error);
}

json_ok(['logs' => $rows->fetch_all(MYSQLI_ASSOC)]);
