<?php
// api/admin/students.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$search = $conn->real_escape_string($_GET['search'] ?? '');
$limit  = min((int)($_GET['limit'] ?? 100), 500);
$offset = (int)($_GET['offset'] ?? 0);

$where = $search ? "WHERE s.name LIKE '%$search%' OR s.index_number LIKE '%$search%' OR s.email LIKE '%$search%'" : '';

$total = (int)$conn->query("SELECT COUNT(*) AS c FROM students s $where")->fetch_assoc()['c'];

$rows = $conn->query("
    SELECT s.*, u.name AS classrep_name
    FROM students s
    LEFT JOIN users u ON u.id = s.user_id
    $where
    ORDER BY s.created_at DESC
    LIMIT $limit OFFSET $offset
")->fetch_all(MYSQLI_ASSOC);

json_ok(['students' => $rows, 'total' => $total]);
