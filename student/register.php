<?php
// api/student/register.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body        = get_body();
$classrep_id = (int)($body['classrep_id'] ?? 0);

if (!$classrep_id) json_error('Invalid registration link.');

$required = ['name','index_number','email','phone','institution','program','department','level'];
foreach ($required as $f) if (empty($body[$f])) json_error("$f is required.");

$index = strtoupper(trim($body['index_number']));

// Check duplicate in this class
$chk = $conn->prepare("SELECT id FROM students WHERE index_number = ? AND user_id = ? LIMIT 1");
$chk->bind_param('si', $index, $classrep_id);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('You are already registered in this class.');

$stmt = $conn->prepare("INSERT INTO students (user_id, name, index_number, email, phone, institution, program, department, level, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
$stmt->bind_param('issssssss', $classrep_id, $body['name'], $index, $body['email'], $body['phone'], $body['institution'], $body['program'], $body['department'], $body['level']);

if (!$stmt->execute()) json_error('Registration failed.');
json_ok(['message' => 'Successfully registered!']);
