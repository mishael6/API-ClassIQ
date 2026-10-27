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

// Update users table only
$stmt = $conn->prepare("UPDATE users SET name=?, email=?, phone=?, institution=?, department=?, program=? WHERE id=?");
$stmt->bind_param('ssssssi', $name, $email, $phone, $institution, $department, $program, $user_id);
if (!$stmt->execute()) json_error('Update failed: ' . $stmt->error);

// Only update the classrep's OWN student record (matched by user_id AND name match)
// The classrep's own student record has a different user_id linkage
// We identify it by checking students where the record belongs to them as a person
$stu = $conn->prepare("
    UPDATE students 
    SET name=?, email=?, phone=?, program=?, department=?, institution=?
    WHERE user_id = ? AND classrep_id IS NULL
");
$stu->bind_param('ssssss i', $name, $email, $phone, $program, $department, $institution, $user_id);
$stu->execute();

json_ok(['message' => 'Profile updated successfully.']);