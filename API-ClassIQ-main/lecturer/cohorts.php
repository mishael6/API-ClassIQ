<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);
$method      = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    json_ok(['cohorts' => lecturer_cohorts_with_students($conn, $lecturer_id)]);
}

if ($method === 'POST') {
    $body = get_body();
    $type = trim($body['type'] ?? 'cohort');

    if ($type === 'cohort' || $type === 'class') {
        $name = trim($body['name'] ?? '');
        if (!$name) json_error('Class name is required (e.g. DIT1A).');
        $stmt = $conn->prepare("INSERT INTO lecturer_cohorts (lecturer_id, name) VALUES (?, ?)");
        $stmt->bind_param('is', $lecturer_id, $name);
        if (!$stmt->execute()) {
            if ($conn->errno === 1062) json_error('A class with this name already exists.');
            json_error('Failed to add class: ' . $stmt->error);
        }
        $id = $conn->insert_id;
        json_ok([
            'message' => 'Class added.',
            'id' => $id,
            'registration_url' => student_frontend_url() . "/student/register?lecturer_id={$lecturer_id}&class_id={$id}",
        ]);
    }

    if ($type === 'student') {
        $cohort_id    = (int)($body['cohort_id'] ?? $body['class_id'] ?? 0);
        $name         = trim($body['name'] ?? '');
        $index_number = strtoupper(trim($body['index_number'] ?? ''));
        $email        = trim($body['email'] ?? '');
        $phone        = trim($body['phone'] ?? '');

        if (!$cohort_id || !lecturer_cohort_context($conn, $cohort_id, $lecturer_id)) json_error('Invalid class.');
        if (!$name || !$index_number || !$email || !$phone) json_error('Name, index, email and phone are required.');

        $lec = $conn->prepare("SELECT institution, course AS program, '' AS department FROM users WHERE id = ? LIMIT 1");
        $lec->bind_param('i', $lecturer_id);
        $lec->execute();
        $info = $lec->get_result()->fetch_assoc();

        $chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? LIMIT 1");
        $chk->bind_param('s', $index_number);
        $chk->execute();
        if ($chk->get_result()->num_rows > 0) json_error('A student with this index number already exists.');

        $ins = $conn->prepare("INSERT INTO students (user_id, lecturer_cohort_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', NOW())");
        $ins->bind_param('iisssssss', $lecturer_id, $cohort_id, $name, $index_number, $email, $phone, $info['institution'], $info['program'], $info['department']);
        if (!$ins->execute()) json_error('Failed to add student: ' . $ins->error);
        json_ok(['message' => 'Student added.', 'id' => $conn->insert_id]);
    }

    json_error('Invalid type.');
}

if ($method === 'PUT') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);
    $name = trim($body['name'] ?? '');
    if (!$id || !$name) json_error('ID and class name required.');
    if (!lecturer_cohort_context($conn, $id, $lecturer_id)) json_error('Class not found.');
    $stmt = $conn->prepare("UPDATE lecturer_cohorts SET name = ? WHERE id = ? AND lecturer_id = ?");
    $stmt->bind_param('sii', $name, $id, $lecturer_id);
    if (!$stmt->execute()) json_error('Update failed.');
    json_ok(['message' => 'Class renamed.']);
}

if ($method === 'DELETE') {
    $body = get_body();
    $type = trim($body['type'] ?? 'cohort');
    $id   = (int)($body['id'] ?? 0);
    if (!$id) json_error('ID required.');

    if ($type === 'student') {
        $stmt = $conn->prepare("DELETE FROM students WHERE id = ? AND user_id = ?");
        $stmt->bind_param('ii', $id, $lecturer_id);
        $stmt->execute();
        json_ok(['message' => 'Student removed.']);
    }

    if (!lecturer_cohort_context($conn, $id, $lecturer_id)) json_error('Class not found.');
    $conn->query("UPDATE students SET lecturer_cohort_id = NULL WHERE lecturer_cohort_id = $id AND user_id = $lecturer_id");
    $conn->query("DELETE FROM lecturer_sessions WHERE cohort_id = $id");
    $stmt = $conn->prepare("DELETE FROM lecturer_cohorts WHERE id = ? AND lecturer_id = ?");
    $stmt->bind_param('ii', $id, $lecturer_id);
    $stmt->execute();
    json_ok(['message' => 'Class removed.']);
}

json_error('Method not allowed', 405);
