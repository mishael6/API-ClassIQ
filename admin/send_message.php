<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/sms_helpers.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — SMS history ─────────────────────────────────────────
if ($method === 'GET') {
    ensure_sms_log_table($conn);

    $limit  = min((int)($_GET['limit'] ?? 20), 100);
    $offset = (int)($_GET['offset'] ?? 0);

    $total = $conn->query("SELECT COUNT(*) AS c FROM sms_log")->fetch_assoc()['c'] ?? 0;
    $rows  = $conn->query("SELECT * FROM sms_log ORDER BY sent_at DESC LIMIT $limit OFFSET $offset")->fetch_all(MYSQLI_ASSOC);

    json_ok(['logs' => $rows, 'total' => (int)$total]);
}

if ($method !== 'POST') json_error('Method not allowed', 405);

set_time_limit(0);
ignore_user_abort(true);

$body           = get_body();
$recipient_type = $body['recipient_type'] ?? 'classrep';
$recipient_id   = (int)($body['recipient_id'] ?? 0);
$message        = trim($body['message'] ?? '');

if (!$message) json_error('Message is required.');

// ── Fetch recipients ──────────────────────────────────────────
$recipients = [];

if ($recipient_type === 'all') {
    $recipients = $conn->query("
        SELECT id, name, phone, 'classrep' AS type FROM users
        WHERE status = 'approved' AND phone != '' AND phone IS NOT NULL
        ORDER BY name
    ")->fetch_all(MYSQLI_ASSOC);

} elseif ($recipient_type === 'all_students') {
    $recipients = $conn->query("
        SELECT id, name, phone, 'student' AS type FROM students
        WHERE phone != '' AND phone IS NOT NULL
        ORDER BY name
    ")->fetch_all(MYSQLI_ASSOC);

} elseif ($recipient_type === 'classrep') {
    if (!$recipient_id) json_error('Please select a class rep.');
    $stmt = $conn->prepare("SELECT id, name, phone, 'classrep' AS type FROM users WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $recipient_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row)                json_error('Class rep not found.');
    if (empty($row['phone'])) json_error('This class rep has no phone number on record.');
    $recipients[] = $row;

} elseif ($recipient_type === 'student') {
    if (!$recipient_id) json_error('Please select a student.');
    $stmt = $conn->prepare("SELECT id, name, phone, 'student' AS type FROM students WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $recipient_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row)                json_error('Student not found.');
    if (empty($row['phone'])) json_error('This student has no phone number on record.');
    $recipients[] = $row;
}

if (empty($recipients)) json_error('No recipients with phone numbers found.');

$result = send_sms_in_batches($conn, $recipients, $message, $recipient_type);

// Send push alongside SMS for bulk student messages
$push_result = ['sent' => 0];
if (in_array($recipient_type, ['all_students', 'all'])) {
    try {
        require_once __DIR__ . '/../push/helpers.php';
        $push_role = $recipient_type === 'all_students' ? 'student' : null;
        $push_result = $push_role
            ? notify_all_students_push($conn, 'ClassIQ', substr($message, 0, 155))
            : broadcast_push($conn, 'ClassIQ', substr($message, 0, 155));
    } catch (Throwable $e) { /* best effort */ }
}

if ($result['sms_sent'] === 0 && !empty($result['errors'])) {
    json_error('Failed to send. ' . implode(' | ', array_slice($result['errors'], 0, 3)));
}

$failed = count($result['errors']);

json_ok([
    'message'  => "{$result['sms_sent']} SMS sent successfully." . ($failed ? " {$failed} failed." : '') .
                  ($push_result['sent'] ? " Push: {$push_result['sent']} devices." : ''),
    'sms_sent' => $result['sms_sent'],
    'total'    => $result['total'] ?? count($recipients),
    'batches'  => $result['batches'],
    'errors'   => array_slice($result['errors'], 0, 20),
    'push_sent' => $push_result['sent'] ?? 0,
]);
