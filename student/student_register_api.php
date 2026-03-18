<?php
// api/student/register.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body        = get_body();
$classrep_id = (int)($body['classrep_id'] ?? 0);

if (!$classrep_id) json_error('Invalid registration link.');

// Validate required personal fields
$name         = trim($body['name']         ?? '');
$index_number = strtoupper(trim($body['index_number'] ?? ''));
$email        = trim($body['email']        ?? '');
$phone        = trim($body['phone']        ?? '');

if (!$name)         json_error('Full name is required.');
if (!$index_number) json_error('Index number is required.');
if (!$email)        json_error('Email address is required.');
if (!$phone)        json_error('Phone number is required.');

// Fetch classrep's institution/department/program automatically
$cr = $conn->prepare("SELECT institution, department, program FROM users WHERE id = ? AND status = 'approved' LIMIT 1");
$cr->bind_param('i', $classrep_id);
$cr->execute();
$classrep = $cr->get_result()->fetch_assoc();
if (!$classrep) json_error('Invalid registration link — class representative not found.');

$institution = $classrep['institution'];
$department  = $classrep['department'];
$program     = $classrep['program'];
$level       = ''; // not required anymore

// Check duplicate index number in this class
$chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? AND user_id = ? LIMIT 1");
$chk->bind_param('si', $index_number, $classrep_id);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('You are already registered in this class.');

// Check duplicate email in this class
$chkEmail = $conn->prepare("SELECT id FROM students WHERE email = ? AND user_id = ? LIMIT 1");
$chkEmail->bind_param('si', $email, $classrep_id);
$chkEmail->execute();
if ($chkEmail->get_result()->num_rows > 0) json_error('This email is already registered in this class.');

// Check duplicate phone in this class
$chkPhone = $conn->prepare("SELECT id FROM students WHERE phone = ? AND user_id = ? LIMIT 1");
$chkPhone->bind_param('si', $phone, $classrep_id);
$chkPhone->execute();
if ($chkPhone->get_result()->num_rows > 0) json_error('This phone number is already registered in this class.');

// Insert student
$ins = $conn->prepare("INSERT INTO students (user_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
$ins->bind_param('issssssss', $classrep_id, $name, $index_number, $email, $phone, $institution, $program, $department, $level);

if (!$ins->execute()) json_error('Registration failed. Please try again.');

json_ok(['message' => 'Successfully registered!']);
