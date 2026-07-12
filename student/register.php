<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body        = get_body();
$lecturer_id = (int)($body['lecturer_id'] ?? 0);
$classrep_id = (int)($body['classrep_id'] ?? 0);
$cohort_id   = (int)($body['class_id'] ?? $body['cohort_id'] ?? 0);

if (!$classrep_id && !$lecturer_id) json_error('Invalid registration link.');

$owner_id    = $lecturer_id ?: $classrep_id;
$is_lecturer = $lecturer_id > 0;

if ($is_lecturer) {
    require_once __DIR__ . '/../lib/lecturer_helpers.php';
    ensure_lecturer_schema($conn);
    $cr = $conn->prepare("SELECT institution, course AS program, '' AS department FROM users WHERE id = ? AND role = 'lecturer' AND status = 'approved' LIMIT 1");
    $cr->bind_param('i', $owner_id);
    $cr->execute();
    $classrep = $cr->get_result()->fetch_assoc();
    if (!$classrep) json_error('Invalid registration link — account not found.');
    if ($cohort_id && !lecturer_cohort_context($conn, $cohort_id, $owner_id)) {
        json_error('Invalid class registration link.');
    }
} else {
    $cr = $conn->prepare("SELECT institution, department, program FROM users WHERE id = ? AND status = 'approved' LIMIT 1");
    $cr->bind_param('i', $owner_id);
    $cr->execute();
    $classrep = $cr->get_result()->fetch_assoc();
    if (!$classrep) json_error('Invalid registration link — account not found.');
}

$name         = trim($body['name'] ?? '');
$index_number = strtoupper(trim($body['index_number'] ?? ''));
$email        = trim($body['email'] ?? '');
$phone        = trim($body['phone'] ?? '');

if (!$name)         json_error('Full name is required.');
if (!$index_number) json_error('Index number is required.');
if (!$email)        json_error('Email address is required.');
if (!$phone)        json_error('Phone number is required.');

$institution = $classrep['institution'];
$department  = $classrep['department'];
$program     = $classrep['program'];
$level       = '';

$chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? LIMIT 1");
$chk->bind_param('s', $index_number);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('A student with this index number is already registered.');

$chkEmail = $conn->prepare("SELECT id FROM students WHERE email = ? LIMIT 1");
$chkEmail->bind_param('s', $email);
$chkEmail->execute();
if ($chkEmail->get_result()->num_rows > 0) json_error('This email address is already registered.');

$chkPhone = $conn->prepare("SELECT id FROM students WHERE phone = ? LIMIT 1");
$chkPhone->bind_param('s', $phone);
$chkPhone->execute();
if ($chkPhone->get_result()->num_rows > 0) json_error('This phone number is already registered.');

if ($is_lecturer) {
    if ($cohort_id) {
        $ins = $conn->prepare("INSERT INTO students (user_id, lecturer_cohort_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $ins->bind_param('iissssssss', $owner_id, $cohort_id, $name, $index_number, $email, $phone, $institution, $program, $department, $level);
    } else {
        $ins = $conn->prepare("INSERT INTO students (user_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $ins->bind_param('issssssss', $owner_id, $name, $index_number, $email, $phone, $institution, $program, $department, $level);
    }
} else {
    $ins = $conn->prepare("INSERT INTO students (user_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $ins->bind_param('issssssss', $owner_id, $name, $index_number, $email, $phone, $institution, $program, $department, $level);
}

if (!$ins->execute()) json_error('Registration failed. Please try again.');

json_ok(['message' => 'Successfully registered!']);
