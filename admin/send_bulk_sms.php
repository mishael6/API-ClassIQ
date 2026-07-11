<?php
// api/admin/send_bulk_sms.php — batched bulk SMS to all students
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/sms_helpers.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

set_time_limit(0);
ignore_user_abort(true);

$body    = get_body();
$message = trim($body['message'] ?? '');

if (!$message) json_error('Message content is required.');

$rows = $conn->query("
    SELECT id, name, phone, 'student' AS type FROM students
    WHERE phone IS NOT NULL AND phone != ''
    ORDER BY name
")->fetch_all(MYSQLI_ASSOC);

if (empty($rows)) json_error('No students with phone numbers found.');

$result = send_sms_in_batches($conn, $rows, $message, 'student');

// Also send push notification to subscribed PWA users
$push_result = ['sent' => 0, 'total' => 0];
try {
    require_once __DIR__ . '/../push/helpers.php';
    $push_result = notify_all_students_push($conn, 'ClassIQ', $message);
} catch (Throwable $e) { /* push is best-effort */ }

if ($result['sms_sent'] === 0 && !empty($result['errors'])) {
    json_error('Failed to send. ' . implode(' | ', array_slice($result['errors'], 0, 3)));
}

$batch_count = count($result['batches']);
$failed      = count($result['errors']);

json_ok([
    'message'  => "{$result['sms_sent']} of {$result['total']} SMS sent in {$batch_count} batch(es)." .
                  ($failed ? " {$failed} failed." : '') .
                  ($push_result['sent'] ? " Push sent to {$push_result['sent']} devices." : ''),
    'sms_sent' => $result['sms_sent'],
    'total'    => $result['total'],
    'batches'  => $result['batches'],
    'errors'   => array_slice($result['errors'], 0, 20),
    'push_sent' => $push_result['sent'],
]);
