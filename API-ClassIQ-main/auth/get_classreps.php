<?php
// api/auth/get_classreps.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$search = trim($_GET['search'] ?? '');

$sql = "
    SELECT s.id, s.name, s.program, s.institution, s.department
    FROM students s
    INNER JOIN users u ON u.id = s.user_id
    WHERE u.role = 'class_rep' AND u.status = 'approved'
";

if ($search) {
    $like = '%' . $conn->real_escape_string($search) . '%';
    $sql .= " AND (s.name LIKE '$like' OR s.program LIKE '$like' OR s.institution LIKE '$like')";
}

$sql .= " ORDER BY s.name ASC LIMIT 50";

$result = $conn->query($sql);
$classreps = $result->fetch_all(MYSQLI_ASSOC);

json_ok(['classreps' => $classreps]);