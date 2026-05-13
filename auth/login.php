<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body         = get_body();
$name         = trim($body['name']         ?? '');
$index_number = trim($body['index_number'] ?? '');
$email        = trim($body['email']        ?? '');
$password     = trim($body['password']     ?? '');

// Mobile login — name + index number
if ($name && $index_number) {
    $stmt = $conn->prepare("
        SELECT id, classrep_id, name, index_number, institution, program, department, level, email, phone
        FROM students
        WHERE name = ? AND index_number = ?
        LIMIT 1
    ");
    $stmt->bind_param('ss', $name, $index_number);
    $stmt->execute();
    $student = $stmt->get_result()->fetch_assoc();

    if (!$student) json_error('No student found with this name and index number.');

    // Check if this student is a classrep
    $stmt2 = $conn->prepare("SELECT id FROM users WHERE id = ? AND role = 'classrep' LIMIT 1");
    $stmt2->bind_param('i', $student['id']);
    $stmt2->execute();
    $classrep = $stmt2->get_result()->fetch_assoc();

    $token = bin2hex(random_bytes(32));
    $upd   = $conn->prepare("UPDATE students SET session_token = ? WHERE id = ?");
    $upd->bind_param('si', $token, $student['id']);
    $upd->execute();

    $student['role'] = $classrep ? 'classrep' : 'student';
    json_ok(['token' => $token, 'user' => $student]);
}

// Web login — email + password (existing classrep login)
if ($email && $password) {
    $stmt = $conn->prepare("SELECT id, name, email, password, status FROM users WHERE email = ? LIMIT 1");
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user)                                         json_error('No account found with this email.');
    if (!password_verify($password, $user['password'])) json_error('Incorrect password.');
    if ($user['status'] === 'pending')                  json_error('Your account is pending admin approval.');
    if ($user['status'] === 'rejected')                 json_error('Your account has been rejected.');
    if ($user['status'] !== 'approved')                 json_error('Your account is not active.');

    $token = bin2hex(random_bytes(32));
    $upd   = $conn->prepare("UPDATE users SET session_token = ? WHERE id = ?");
    $upd->bind_param('si', $token, $user['id']);
    $upd->execute();

    // ✅ Fetch their student record to get student_id for trivia
    $stu = $conn->prepare("SELECT id as student_id FROM students WHERE user_id = ? LIMIT 1");
    $stu->bind_param('i', $user['id']);
    $stu->execute();
    $stuRow = $stu->get_result()->fetch_assoc();
    if ($stuRow) $user['student_id'] = $stuRow['student_id'];

    unset($user['password'], $user['status']);
    $user['role'] = 'classrep';
    json_ok(['token' => $token, 'user' => $user]);
}

json_error('Invalid request. Provide name + index_number or email + password.');