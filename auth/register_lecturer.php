<?php
// api/auth/register_lecturer.php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

ensure_lecturer_schema($conn);

$body        = get_body();
$name        = trim($body['name']             ?? '');
$email       = trim($body['email']            ?? '');
$password    = trim($body['password']         ?? '');
$confirm     = trim($body['confirm_password'] ?? '');
$institution = trim($body['institution']      ?? '');
$course      = trim($body['course']           ?? '');

if (!$name || !$email || !$password || !$institution || !$course) {
    json_error('Name, institution, course, email and password are required.');
}
if ($password !== $confirm) json_error('Passwords do not match.');
if (strlen($password) < 6) json_error('Password must be at least 6 characters.');

$chk = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
$chk->bind_param('s', $email);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('An account with this email already exists.');

$hash   = password_hash($password, PASSWORD_DEFAULT);
$role   = 'lecturer';
$status = 'pending';
$empty  = '';

$stmt = $conn->prepare("
    INSERT INTO users (name, email, password, phone, institution, department, program, course, role, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param('ssssssssss', $name, $email, $hash, $empty, $institution, $empty, $empty, $course, $role, $status);

if (!$stmt->execute()) json_error('Registration failed: ' . $stmt->error);

$adminPhone = getenv('ADMIN_PHONE');
if ($adminPhone) {
    $msg = "New ClassIQ Lecturer!\nName: $name\nCourse: $course\nInst: $institution\nPlease approve in Admin → Lecturers.";
    send_admin_sms($adminPhone, $msg);
}

json_ok(['message' => 'Application submitted. Wait for admin approval before logging in.']);
