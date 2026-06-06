<?php
// api/student/report_issue.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user = require_auth($conn);
$student_id = $user['id'];
$body = get_body();

$subject = trim($body['subject'] ?? '');
$message = trim($body['message'] ?? '');

if (!$subject || !$message) json_error('Subject and message are required.');

// Store in troubleshooting_logs table, using user_type to differentiate from classrep
$full_message = "Subject: {$subject}\n\n{$message}";
$stmt = $conn->prepare("INSERT INTO troubleshooting_logs (user_id, message, status, created_at, user_type) VALUES (?, ?, 'pending', NOW(), 'student')");
$stmt->bind_param('is', $student_id, $full_message);

if (!$stmt->execute()) json_error('Failed to submit report.');
json_ok(['message' => 'Issue reported successfully.']);
