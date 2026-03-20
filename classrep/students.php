<?php
require_once __DIR__ . '/../bootstrap.php';

$user        = require_auth($conn);
$classrep_id = $user['id'];
$method      = $_SERVER['REQUEST_METHOD'];
$body        = ($method !== 'GET') ? get_body() : [];

// Method override — POST can act as PUT or DELETE
$effective = $method;
if ($method === 'POST' && !empty($body['_method'])) {
    $effective = strtoupper($body['_method']);
}

// ── GET — list students ───────────────────────────────────────
if ($effective === 'GET') {
    $search = $conn->real_escape_string($_GET['search'] ?? '');
    $limit  = min((int)($_GET['limit'] ?? 50), 200);
    $offset = (int)($_GET['offset'] ?? 0);

    $where = "WHERE user_id = $classrep_id";
    if ($search) $where .= " AND (name LIKE '%$search%' OR index_number LIKE '%$search%' OR program LIKE '%$search%')";

    $total = $conn->query("SELECT COUNT(*) AS c FROM students $where")->fetch_assoc()['c'];
    $rows  = $conn->query("SELECT * FROM students $where ORDER BY created_at DESC LIMIT $limit OFFSET $offset")->fetch_all(MYSQLI_ASSOC);

    json_ok(['students' => $rows, 'total' => (int)$total]);
}

// ── DELETE — remove student ───────────────────────────────────
if ($effective === 'DELETE') {
    $student_id = (int)($body['id'] ?? 0);
    if (!$student_id) json_error('Student ID required.');

    // Delete attendance records first to avoid FK constraint
    $conn->query("DELETE FROM attendance WHERE student_id = $student_id");

    $stmt = $conn->prepare("DELETE FROM students WHERE id = ? AND user_id = ?");
    $stmt->bind_param('ii', $student_id, $classrep_id);
    if (!$stmt->execute()) json_error('Failed to delete.');
    json_ok(['message' => 'Student deleted.']);
}

// ── PUT — update student ──────────────────────────────────────
if ($effective === 'PUT') {
    $student_id = (int)($body['id'] ?? 0);
    if (!$student_id) json_error('Student ID required.');

    $stmt = $conn->prepare("UPDATE students SET name=?, index_number=?, email=?, phone=?, institution=?, program=?, department=?, level=? WHERE id=? AND user_id=?");
    $stmt->bind_param('ssssssssii',
        $body['name'], strtoupper($body['index_number']),
        $body['email'], $body['phone'], $body['institution'],
        $body['program'], $body['department'], $body['level'],
        $student_id, $classrep_id
    );
    if (!$stmt->execute()) json_error('Failed to update student.');
    json_ok(['message' => 'Student updated.']);
}

// ── POST — add student ────────────────────────────────────────
if ($effective === 'POST') {
    $fields = ['name','index_number','email','phone','institution','program','department','level'];
    foreach ($fields as $f) if (empty($body[$f])) json_error("$f is required.");

    $index = strtoupper(trim($body['index_number']));
    $chk   = $conn->prepare("SELECT id FROM students WHERE index_number = ? AND user_id = ? LIMIT 1");
    $chk->bind_param('si', $index, $classrep_id);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) json_error('A student with this index number already exists.');

    $stmt = $conn->prepare("INSERT INTO students (user_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->bind_param('issssssss', $classrep_id, $body['name'], $index, $body['email'], $body['phone'], $body['institution'], $body['program'], $body['department'], $body['level']);
    if (!$stmt->execute()) json_error('Failed to add student.');
    json_ok(['message' => 'Student added.', 'id' => $conn->insert_id]);
}

json_error('Method not allowed.', 405);
