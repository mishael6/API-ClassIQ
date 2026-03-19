<?php
// api/classrep/students.php
require_once __DIR__ . '/../bootstrap.php';
$user        = require_auth($conn);
$classrep_id = $user['id'];
$method      = $_SERVER['REQUEST_METHOD'];

// ── PUT — update student ──────────────────────────────────────
if ($method === 'PUT') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);
    if (!$id) json_error('Student ID required.');

    // Verify student belongs to this classrep
    $chk = $conn->prepare("SELECT id FROM students WHERE id = ? AND user_id = ? LIMIT 1");
    $chk->bind_param('ii', $id, $classrep_id);
    $chk->execute();
    if ($chk->get_result()->num_rows === 0) json_error('Student not found.');

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
            name='$name', index_number='$index_number', email='$email',
            phone='$phone', institution='$institution', department='$department',
            program='$program', level='$level'
        WHERE id=$id AND user_id=$classrep_id
    ");

    if (!$result) json_error('Update failed: ' . $conn->error);
    json_ok(['message' => 'Student updated successfully.']);
}

json_error('Method not allowed.', 405);
