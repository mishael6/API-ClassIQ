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
    json_ok(['message' => 'Student updated successfully.']);
}

json_error('Method not allowed.', 405);

// ── DELETE — remove student ───────────────────────────────────
if ($method === 'DELETE') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);
    if (!$id) json_error('Student ID required.');

    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    $conn->query("DELETE FROM attendance WHERE student_id = $id");
    $conn->query("DELETE FROM students   WHERE id = $id");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1");

    json_ok(['message' => 'Student deleted.']);
}<?php
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
    // Only name, index_number, email, phone are required
    $required = ['name','index_number','email','phone'];
    foreach ($required as $f) if (empty($body[$f])) json_error("$f is required.");

    $index       = strtoupper(trim($body['index_number']));
    $institution = trim($body['institution'] ?? '');
    $program     = trim($body['program']     ?? '');
    $department  = trim($body['department']  ?? '');
    $level       = trim($body['level']       ?? '');

    // If institution empty, auto-fill from classrep account
    if (!$institution || !$program || !$department) {
        $cr = $conn->query("SELECT institution, program, department FROM users WHERE id = $classrep_id LIMIT 1")->fetch_assoc();
        if (!$institution) $institution = $cr['institution'] ?? '';
        if (!$program)     $program     = $cr['program']     ?? '';
        if (!$department)  $department  = $cr['department']  ?? '';
    }

    $chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? AND user_id = ? LIMIT 1");
    $chk->bind_param('si', $index, $classrep_id);
    $chk->execute();
    if ($chk->get_result()->num_rows > 0) json_error('A student with this index number already exists.');

    $stmt = $conn->prepare("INSERT INTO students (user_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->bind_param('issssssss', $classrep_id, $body['name'], $index, $body['email'], $body['phone'], $institution, $program, $department, $level);
    if (!$stmt->execute()) json_error('Failed to add student.');
    json_ok(['message' => 'Student added.', 'id' => $conn->insert_id]);
}

json_error('Method not allowed.', 405);
