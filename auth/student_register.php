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
$classrep_id  = (int)($body['classrep_id'] ?? 0);

if (!$name)         json_error('Full name is required.');
if (!$index_number) json_error('Index number is required.');
if (!$institution)  json_error('Institution is required.');

// Check duplicate index number
$chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? LIMIT 1");
$chk->bind_param('s', $index_number);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('A student with this index number already exists.');

// Get classrep's user_id if provided
$cr_user_id = null;
if ($classrep_id > 0) {
    $cr = $conn->prepare("SELECT user_id FROM students WHERE id = ? LIMIT 1");
    $cr->bind_param('i', $classrep_id);
    $cr->execute();
    $crRow = $cr->get_result()->fetch_assoc();
    if ($crRow) $cr_user_id = $crRow['user_id'];
}

$program    = '';
$department = '';
$level      = '';

$stmt = $conn->prepare("
    INSERT INTO students (name, index_number, institution, email, phone, program, department, level, classrep_id, user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
");

$null_user_id = $cr_user_id;
$null_classrep = $classrep_id > 0 ? $classrep_id : null;

$stmt->bind_param(
    'ssssssssii',
    $name,
    $index_number,
    $institution,
    $email,
    $phone,
    $program,
    $department,
    $level,
    $null_classrep,
    $null_user_id
);

if (!$stmt->execute()) json_error('Registration failed: ' . $stmt->error);

json_ok(['message' => 'Account created successfully! You can now log in.']);