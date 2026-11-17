<?php
// api/admin/students.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list with pagination ────────────────────────────────
if ($method === 'GET') {
    $search      = $conn->real_escape_string($_GET['search']      ?? '');
    $classrep_id = (int)($_GET['classrep_id'] ?? 0);
    $unassigned  = (int)($_GET['unassigned'] ?? 0) === 1;
    $limit       = min((int)($_GET['limit']   ?? 10), 100);
    $offset      = (int)($_GET['offset']      ?? 0);
    $date_filter = $conn->real_escape_string($_GET['date'] ?? '');

    $where = '1=1';
    if ($search)      $where .= " AND (s.name LIKE '%$search%' OR s.index_number LIKE '%$search%' OR s.email LIKE '%$search%')";
    if ($unassigned)      $where .= ' AND (s.user_id IS NULL OR s.user_id = 0)';
    elseif ($classrep_id) $where .= " AND s.user_id = $classrep_id";

    $total = (int)$conn->query("SELECT COUNT(*) AS c FROM students s WHERE $where")->fetch_assoc()['c'];

    $date_select = "";
    if ($date_filter) {
        $date_select = ", (SELECT status FROM attendance WHERE student_id = s.id AND attendance_date = '$date_filter' AND deleted_at IS NULL LIMIT 1) AS attendance_status";
    }

    $rows = $conn->query("
        SELECT s.id, s.name, s.index_number, s.email, s.phone, s.institution,
               s.department, s.program, s.level, s.user_id, s.created_at,
               u.name AS classrep_name $date_select
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

    if (($body['action'] ?? '') === 'assign_classrep') {
        $classrep_id = (int)($body['classrep_id'] ?? 0);
        if (!$classrep_id) json_error('Select an approved class representative.');

        $rep = $conn->query("SELECT id FROM users WHERE id = $classrep_id AND role IN ('class_rep', 'classrep') AND status = 'approved' LIMIT 1");
        if (!$rep || !$rep->num_rows) json_error('The selected class representative is not approved or no longer exists.');

        $result = $conn->query("UPDATE students SET user_id = $classrep_id, classrep_id = $classrep_id WHERE id = $id");
        if (!$result) json_error('Failed to assign student: ' . $conn->error);
        if ($conn->affected_rows === 0) {
            $student = $conn->query("SELECT id FROM students WHERE id = $id LIMIT 1");
            if (!$student || !$student->num_rows) json_error('Student not found.');
        }

        json_ok(['message' => 'Student assigned to class representative.']);
    }

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
}
