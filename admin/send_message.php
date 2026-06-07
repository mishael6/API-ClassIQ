<?php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — SMS history ─────────────────────────────────────────
if ($method === 'GET') {
    $limit  = min((int)($_GET['limit'] ?? 20), 100);
    $offset = (int)($_GET['offset'] ?? 0);

    $total = $conn->query("SELECT COUNT(*) AS c FROM sms_log")->fetch_assoc()['c'] ?? 0;
    $rows  = $conn->query("
        SELECT * FROM sms_log
        ORDER BY sent_at DESC
        LIMIT $limit OFFSET $offset
    ")->fetch_all(MYSQLI_ASSOC);

    json_ok(['logs' => $rows, 'total' => (int)$total]);
}

if ($method !== 'POST') json_error('Method not allowed', 405);

$body           = get_body();
$recipient_type = $body['recipient_type'] ?? 'classrep';
$recipient_id   = (int)($body['recipient_id'] ?? 0);
$message        = trim($body['message'] ?? '');

if (!$message) json_error('Message is required.');

// ── Fetch recipients ──────────────────────────────────────────
$recipients = [];

if ($recipient_type === 'all') {
    // All approved classreps
    $rows = $conn->query("
        SELECT id, name, phone, 'classrep' AS type FROM users
        WHERE status = 'approved' AND phone != '' AND phone IS NOT NULL
        ORDER BY name
    ")->fetch_all(MYSQLI_ASSOC);
    $recipients = $rows;

} elseif ($recipient_type === 'all_students') {
    // All students
    $rows = $conn->query("
        SELECT id, name, phone, 'student' AS type FROM students
        WHERE phone != '' AND phone IS NOT NULL
        ORDER BY name
    ")->fetch_all(MYSQLI_ASSOC);
    $recipients = $rows;

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

// ── Payloqa config ────────────────────────────────────────────
$api_key     = getenv('PAYLOQA_API_KEY')     ?: 'pk_live_of502pjkel';
$platform_id = getenv('PAYLOQA_PLATFORM_ID') ?: 'plat_xvadsq3rx0f';
$sender_id   = getenv('PAYLOQA_SENDER')      ?: 'ClassIQ';

$sms_sent = 0;
$errors   = [];
$msg_trim = substr($message, 0, 155);

// ── Send ──────────────────────────────────────────────────────
foreach ($recipients as $r) {
    $phone = preg_replace('/\D/', '', $r['phone']);
    if (strlen($phone) === 10 && str_starts_with($phone, '0')) {
        $phone = '+233' . substr($phone, 1);
    } elseif (strlen($phone) === 9) {
        $phone = '+233' . $phone;
    } elseif (strlen($phone) === 12 && str_starts_with($phone, '233')) {
        $phone = '+' . $phone;
    } else {
        $errors[] = "{$r['name']}: invalid phone ({$r['phone']})";
        continue;
    }

    $payload = json_encode([
        'recipient_number'   => $phone,
        'sender_id'          => $sender_id,
        'message'            => $msg_trim,
        'usage_message_type' => 'notification',
    ]);

    $ch = curl_init('https://sms.payloqa.com/api/v1/sms/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-API-Key: '     . $api_key,
            'X-Platform-Id: ' . $platform_id,
        ],
        CURLOPT_TIMEOUT => 15,
    ]);

    $resp      = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resp_data = json_decode($resp, true);
    $ok = $http_code === 200 && ($resp_data['success'] ?? false);

    if ($ok) {
        $sms_sent++;
    } else {
        $err = $resp_data['message'] ?? $resp_data['error'] ?? $resp_data['data']['message'] ?? null;
        if (is_array($err)) $err = json_encode($err);
        if (!$err)          $err = json_encode($resp_data) ?: "HTTP $http_code";
        $errors[] = "{$r['name']} ({$phone}): $err";
    }

    // Log every attempt
    $rname  = $conn->real_escape_string($r['name']);
    $rtype  = $conn->real_escape_string($r['type'] ?? $recipient_type);
    $rmsg   = $conn->real_escape_string($msg_trim);
    $rphone = $conn->real_escape_string($phone);
    $status = $ok ? 'sent' : 'failed';
    $conn->query("
        INSERT INTO sms_log (recipient_name, recipient_type, recipient_phone, message, status, sent_at)
        VALUES ('$rname', '$rtype', '$rphone', '$rmsg', '$status', NOW())
    ");
}

if ($sms_sent === 0) {
    json_error('Failed to send. ' . implode(' | ', $errors));
}

json_ok([
    'message'  => "$sms_sent SMS sent successfully." . (!empty($errors) ? ' Some failed.' : ''),
    'sms_sent' => $sms_sent,
    'errors'   => $errors,
]);
