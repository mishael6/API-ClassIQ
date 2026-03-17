<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = get_body();
$name            = trim($body['name']             ?? '');
$email           = trim($body['email']            ?? '');
$password        = trim($body['password']         ?? '');
$confirm         = trim($body['confirm_password'] ?? '');
$institution     = trim($body['institution']      ?? '');
$department      = trim($body['department']       ?? '');
$program         = trim($body['program']          ?? '');

if (!$name || !$email || !$password) json_error('Name, email and password are required.');
if ($password !== $confirm)          json_error('Passwords do not match.');
if (strlen($password) < 6)          json_error('Password must be at least 6 characters.');

// Check duplicate email
$chk = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
$chk->bind_param('s', $email);
$chk->execute();
if ($chk->get_result()->num_rows > 0) json_error('An account with this email already exists.');

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("INSERT INTO users (name, email, password, institution, department, program, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
$stmt->bind_param('ssssss', $name, $email, $hash, $institution, $department, $program);

if (!$stmt->execute()) json_error('Registration failed. Please try again.');

json_ok(['message' => 'Account created successfully.']);
