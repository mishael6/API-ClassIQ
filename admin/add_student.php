<?php
// api/admin/add_student.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body        = get_body();
$classrep_id = (int)($body['classrep_id'] ?? 0);
$name         = $conn->real_escape_string(trim($body['name']         ?? ''));
$index_number = strtoupper($conn->real_escape_string(trim($body['index_number'] ?? '')));
$email        = $conn->real_escape_string(trim($body['email']        ?? ''));
$phone        = $conn->real_escape_string(trim($body['phone']        ?? ''));
$institution  = $conn->real_escape_string(trim($body['institution']  ?? ''));
$department   = $conn->real_escape_string(trim($body['department']   ?? ''));
$program      = $conn->real_escape_string(trim($body['program']      ?? ''));
$level        = $conn->real_escape_string(trim($body['level']        ?? ''));

if (!$classrep_id)   json_error('Class representative is required.');
if (!$name)          json_error('Full name is required.');
if (!$index_number)  json_error('Index number is required.');
if (!$email)         json_error('Email is required.');
if (!$phone)         json_error('Phone is required.');

// Check classrep exists
$cr = $conn->query("SELECT id FROM users WHERE id = $classrep_id LIMIT 1");
if ($cr->num_rows === 0) json_error('Class representative not found.');

// Check duplicate index number under this classrep
$chk = $conn->query("SELECT id FROM students WHERE index_number = '$index_number' AND user_id = $classrep_id LIMIT 1");
if ($chk->num_rows > 0) json_error('A student with this index number already exists under this class rep.');

// Check duplicate email under this classrep
$chkE = $conn->query("SELECT id FROM students WHERE email = '$email' AND user_id = $classrep_id LIMIT 1");
if ($chkE->num_rows > 0) json_error('A student with this email already exists under this class rep.');

$result = $conn->query("
    INSERT INTO students (user_id, name, index_number, email, phone, institution, department, program, level, created_at)
    VALUES ($classrep_id, '$name', '$index_number', '$email', '$phone', '$institution', '$department', '$program', '$level', NOW())
");

if (!$result) json_error('Failed to add student: ' . $conn->error);

json_ok(['message' => 'Student added successfully.', 'id' => $conn->insert_id]);