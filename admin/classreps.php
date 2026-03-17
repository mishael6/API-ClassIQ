<?php
// api/admin/classreps.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$search = $conn->real_escape_string($_GET['search'] ?? '');
$where  = $search ? "WHERE name LIKE '%$search%' OR email LIKE '%$search%'" : '';

$rows = $conn->query("
    SELECT u.id, u.name, u.email, u.institution, u.department, u.program, u.created_at,
           COUNT(s.id) AS student_count
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    $where
    GROUP BY u.id
    ORDER BY u.created_at DESC
")->fetch_all(MYSQLI_ASSOC);

json_ok(['classreps' => $rows]);
