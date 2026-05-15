<?php
// api/auth/student_register.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body         = get_body();
$name         = trim($body['name']         ?? '');
$index_number = strtoupper(trim($body['index_number'] ?? ''));
$institution  = trim($body['institution']  ?? '');
$email        = trim($body['email']        ?? '');
$phone        = trim($body['phone']        ?? '');
$password     = trim($body['password']     ?? '');
$confirm      = trim($body['confirm_password'] ?? '');
$classrep_id  = (int)($body['classrep_id'] ?? 0);

if (!$name)         json_error('Full name is required.');
if (!$index_number) json_error('Index number is required.');
if (!$institution)  json_error('Institution is required.');
if (!$password)     json_error('Password is required.');
if (strlen($password) < 6) json_error('Password must be at least 6 characters.');
if ($password !== $confirm) json_error('Passwords do not match.');

// Check duplicate index number
$chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? LIMIT 1");
$chk->bind_param('s', $index_number);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('A student with this index number already exists.');

$hashed = password_hash($password, PASSWORD_DEFAULT);

$program    = '';
$department = '';
$level      = '';

// Get classrep user_id if provided
$null_classrep = $classrep_id > 0 ? $classrep_id : null;
$null_user_id  = null;

if ($classrep_id > 0) {
    $cr = $conn->prepare("SELECT user_id FROM students WHERE id = ? LIMIT 1");
    $cr->bind_param('i', $classrep_id);
    $cr->execute();
    $crRow = $cr->get_result()->fetch_assoc();
    if ($crRow) $null_user_id = $crRow['user_id'];
}

$stmt = $conn->prepare("
    INSERT INTO students (name, index_number, institution, email, phone, password, program, department, level, classrep_id, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param(
    'sssssssssii',
    $name, $index_number, $institution,
    $email, $phone, $hashed,
    $program, $department, $level,
    $null_classrep, $null_user_id
);

if (!$stmt->execute()) json_error('Registration failed: ' . $stmt->error);

json_ok(['message' => 'Account created successfully! You can now log in.']);