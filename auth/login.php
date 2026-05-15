<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body         = get_body();
$index_number = strtoupper(trim($body['index_number'] ?? ''));
$password     = trim($body['password'] ?? '');

if (!$index_number || !$password) json_error('Index number and password are required.');

$stmt = $conn->prepare("
    SELECT id, classrep_id, name, index_number, institution, program, department, level, email, phone, password
    FROM students
    WHERE index_number = ?
    LIMIT 1
");
$stmt->bind_param('s', $index_number);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();

if (!$student) json_error('No student found with this index number.');
if (!password_verify($password, $student['password'])) json_error('Incorrect password.');

$token = bin2hex(random_bytes(32));
$upd   = $conn->prepare("UPDATE students SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $student['id']);
$upd->execute();

unset($student['password']);
$student['role'] = 'student';
json_ok(['token' => $token, 'user' => $student]);