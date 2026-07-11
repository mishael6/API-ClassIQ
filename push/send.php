<?php
// api/push/send.php — admin broadcast push notification
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body  = get_body();
$title = trim($body['title'] ?? 'ClassIQ');
$body_text = trim($body['body'] ?? '');
$role  = trim($body['role'] ?? 'student');

if (!$body_text) json_error('Notification body is required.');

$allowed_roles = ['student', 'classrep', 'all'];
if (!in_array($role, $allowed_roles)) json_error('Invalid role.');

$result = $role === 'all'
    ? broadcast_push($conn, $title, $body_text, null, null, 'manual')
    : broadcast_push($conn, $title, $body_text, $role, null, 'manual');

if ($result['total'] === 0) {
    json_error(
        'No active push subscriptions found. A student must open the ClassIQ PWA from their Home Screen, log in, go to Settings, and enable Push Notifications (tap Allow). Check the count at the top of this page — it should show 1+ before sending.'
    );
}

json_ok([
    'message' => "Push sent to {$result['sent']} of {$result['total']} devices." .
                 ($result['failed'] ? " {$result['failed']} failed." : ''),
    'sent'    => $result['sent'],
    'failed'  => $result['failed'],
    'total'   => $result['total'],
]);
