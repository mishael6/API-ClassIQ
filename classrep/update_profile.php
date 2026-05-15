<?php
require_once __DIR__ . '/../bootstrap.php';
if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_auth($conn);
$user_id = $user['id'];

$body = get_body();
$name        = trim($body['name']        ?? '');
$email       = trim($body['email']       ?? '');
$phone       = trim($body['phone']       ?? '');
$program     = trim($body['program']     ?? '');
$department  = trim($body['department']  ?? '');
$institution = trim($body['institution'] ?? '');

// Update users table
$stmt = $conn->prepare("UPDATE users SET name=?, email=?, phone=?, institution=?, department=?, program=? WHERE id=?");
$stmt->bind_param('ssssssi', $name, $email, $phone, $institution, $department, $program, $user_id);
if (!$stmt->execute()) json_error('Update failed: ' . $stmt->error);

// Also update students table if they have a student record
$stu = $conn->prepare("UPDATE students SET name=?, email=?, phone=?, program=?, department=?, institution=? WHERE user_id=?");
$stu->bind_param('ssssssi', $name, $email, $phone, $program, $department, $institution, $user_id);
$stu->execute();

json_ok(['message' => 'Profile updated successfully.']);