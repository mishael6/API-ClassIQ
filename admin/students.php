<?php
// api/admin/students.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$search      = $conn->real_escape_string($_GET['search']      ?? '');
$classrep_id = (int)($_GET['classrep_id'] ?? 0);
$limit       = min((int)($_GET['limit']  ?? 100), 500);
$offset      = (int)($_GET['offset']     ?? 0);

$where = '1=1';
if ($search)      $where .= " AND (s.name LIKE '%$search%' OR s.index_number LIKE '%$search%' OR s.email LIKE '%$search%')";
if ($classrep_id) $where .= " AND s.user_id = $classrep_id";

$total = (int)$conn->query("SELECT COUNT(*) AS c FROM students s WHERE $where")->fetch_assoc()['c'];

$rows = $conn->query("
    SELECT s.*, u.name AS classrep_name
    FROM students s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE $where
    ORDER BY s.name ASC
    LIMIT $limit OFFSET $offset
")->fetch_all(MYSQLI_ASSOC);

json_ok(['students' => $rows, 'total' => $total]);
