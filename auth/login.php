<?php
require_once __DIR__ . '/../../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body         = get_body();
$name         = trim($body['name']         ?? '');
$index_number = trim($body['index_number'] ?? '');

if (!$name || !$index_number) json_error('Name and index number are required.');

// Find student by name and index number
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
$stmt2 = $conn->prepare("
    SELECT id FROM users WHERE id = ? LIMIT 1
");
$stmt2->bind_param('i', $student['id']);
$stmt2->execute();
$classrep = $stmt2->get_result()->fetch_assoc();

// Generate session token
$token = bin2hex(random_bytes(32));
$upd   = $conn->prepare("UPDATE students SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $student['id']);
$upd->execute();

// Assign role based on whether they are a classrep
$student['role'] = $classrep ? 'classrep' : 'student';
if ($classrep) {
    $student['classrep_record_id'] = $classrep['id'];
}

json_ok(['token' => $token, 'user' => $student]);