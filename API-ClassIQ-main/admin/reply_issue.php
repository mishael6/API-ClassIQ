<?php
// api/admin/reply_issue.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = get_body();
$issue_id = (int)($body['issue_id'] ?? 0);
$reply = trim($body['reply'] ?? '');

if (!$issue_id || !$reply) json_error('Issue ID and reply are required.');

// Assuming a messages table exists or we append to troubleshooting_logs
// Let's create a reply entry in the troubleshooting_logs or a new messages table if needed.
// Based on admin/issues.php line 18, it seems there's a messages table.
$stmt = $conn->prepare("INSERT INTO messages (issue_id, sender_role, message, is_read, created_at) VALUES (?, 'admin', ?, 0, NOW())");
$stmt->bind_param('is', $issue_id, $reply);

if (!$stmt->execute()) json_error('Failed to send reply.');
json_ok(['message' => 'Reply sent successfully.']);
