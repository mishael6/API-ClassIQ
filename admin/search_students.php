<?php
// api/admin/search_students.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$q = $conn->real_escape_string(trim($_GET['q'] ?? ''));
if (strlen($q) < 2) json_ok(['students' => []]);

$rows = $conn->query("
    SELECT s.id, s.name, s.index_number, s.email, s.program, s.level,
           u.name AS classrep_name
    FROM students s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.name LIKE '%$q%' OR s.index_number LIKE '%$q%' OR s.email LIKE '%$q%'
    ORDER BY s.name ASC
    LIMIT 30
")->fetch_all(MYSQLI_ASSOC);

json_ok(['students' => $rows]);
