<?php
// api/admin/students.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list with pagination ────────────────────────────────
if ($method === 'GET') {
    $search      = $conn->real_escape_string($_GET['search']      ?? '');
    $classrep_id = (int)($_GET['classrep_id'] ?? 0);
    $limit       = min((int)($_GET['limit']   ?? 10), 100);
    $offset      = (int)($_GET['offset']      ?? 0);

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
}

// ── PUT — update student ──────────────────────────────────────
if ($method === 'PUT') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);
    if (!$id) json_error('Student ID required.');

    $name         = $conn->real_escape_string(trim($body['name']         ?? ''));
    $index_number = strtoupper($conn->real_escape_string(trim($body['index_number'] ?? '')));
    $email        = $conn->real_escape_string(trim($body['email']        ?? ''));
    $phone        = $conn->real_escape_string(trim($body['phone']        ?? ''));
    $institution  = $conn->real_escape_string(trim($body['institution']  ?? ''));
    $department   = $conn->real_escape_string(trim($body['department']   ?? ''));
    $program      = $conn->real_escape_string(trim($body['program']      ?? ''));
    $level        = $conn->real_escape_string(trim($body['level']        ?? ''));

    $result = $conn->query("
        UPDATE students SET
            name         = '$name',
            index_number = '$index_number',
            email        = '$email',
            phone        = '$phone',
            institution  = '$institution',
            department   = '$department',
            program      = '$program',
            level        = '$level'
        WHERE id = $id
    ");

    if (!$result) json_error('Failed to update: ' . $conn->error);
    json_ok(['message' => 'Student updated successfully, Check it out.']);
}

json_error('Method not allowed.', 405);
