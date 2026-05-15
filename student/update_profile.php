<?php
require_once __DIR__ . '/../bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = get_body();
$token = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$token = str_replace('Bearer ', '', $token);

$stu = $conn->prepare("SELECT id FROM students WHERE session_token = ? LIMIT 1");
$stu->bind_param('s', $token);
$stu->execute();
$student = $stu->get_result()->fetch_assoc();
if (!$student) json_error('Unauthorized.', 401);

$name        = trim($body['name']        ?? '');
$email       = trim($body['email']       ?? '');
$phone       = trim($body['phone']       ?? '');
$program     = trim($body['program']     ?? '');
$department  = trim($body['department']  ?? '');
$level       = trim($body['level']       ?? '');
$institution = trim($body['institution'] ?? '');

$stmt = $conn->prepare("
    UPDATE students SET name=?, email=?, phone=?, program=?, department=?, level=?, institution=?
    WHERE id=?
");
$stmt->bind_param('sssssssi', $name, $email, $phone, $program, $department, $level, $institution, $student['id']);
if (!$stmt->execute()) json_error('Update failed: ' . $stmt->error);

json_ok(['message' => 'Profile updated successfully.']);