<?php
// api/admin/logs.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

// The frontend `AdminLogsPage.jsx` explicitly renders `login_logs` data
// such as IP addresses, user roles, and login times. Let's fetch the actual data.

$rows = $conn->query("
    SELECT l.*, u.name, u.role
    FROM login_logs l
    LEFT JOIN users u ON u.id = l.user_id
    ORDER BY l.created_at DESC
    LIMIT 200
")->fetch_all(MYSQLI_ASSOC);

json_ok(['logs' => $rows]);
