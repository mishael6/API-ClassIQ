<?php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — SMS history ─────────────────────────────────────────
if ($method === 'GET') {
    $limit  = min((int)($_GET['limit'] ?? 20), 100);
    $offset = (int)($_GET['offset'] ?? 0);

    // Create table if not exists
    $conn->query("CREATE TABLE IF NOT EXISTS sms_log (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name  VARCHAR(255) NOT NULL,
        recipient_type  VARCHAR(20)  NOT NULL,
        recipient_phone VARCHAR(20)  NOT NULL,
        message         TEXT         NOT NULL,
        status          VARCHAR(10)  NOT NULL,
        sent_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");

    $total = $conn->query("SELECT COUNT(*) AS c FROM sms_log")->fetch_assoc()['c'] ?? 0;
    $rows  = $conn->query("SELECT * FROM sms_log ORDER BY sent_at DESC LIMIT $limit OFFSET $offset")->fetch_all(MYSQLI_ASSOC);

    json_ok(['logs' => $rows, 'total' => (int)$total]);
}

if ($method !== 'POST') json_error('Method not allowed', 405);

// Prevent timeout for bulk sends
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
    $rows = $conn->query("
        SELECT id, name, phone, 'classrep' AS type FROM users
        WHERE status = 'approved' AND phone != '' AND phone IS NOT NULL
        ORDER BY name
    ")->fetch_all(MYSQLI_ASSOC);
    $recipients = $rows;

} elseif ($recipient_type === 'all_students') {
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
$msg_trim    = substr($message, 0, 155);

// ── Send using multi-curl for speed ──────────────────────────
$sms_sent = 0;
$errors   = [];
$mh       = curl_multi_init();
$handles  = [];

// Normalize phone numbers and build curl handles
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
        CURLOPT_TIMEOUT => 20,
    ]);

    $handles[] = ['ch' => $ch, 'recipient' => $r, 'phone' => $phone];
    curl_multi_add_handle($mh, $ch);
}

// Execute all requests in parallel
$running = null;
do {
    curl_multi_exec($mh, $running);
    curl_multi_select($mh);
} while ($running > 0);

// ── Collect results ───────────────────────────────────────────
// Ensure sms_log table exists
$conn->query("CREATE TABLE IF NOT EXISTS sms_log (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    recipient_name  VARCHAR(255) NOT NULL,
    recipient_type  VARCHAR(20)  NOT NULL,
    recipient_phone VARCHAR(20)  NOT NULL,
    message         TEXT         NOT NULL,
    status          VARCHAR(10)  NOT NULL,
    sent_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
)");

foreach ($handles as $item) {
    $ch        = $item['ch'];
    $r         = $item['recipient'];
    $phone     = $item['phone'];
    $resp      = curl_multi_getcontent($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_multi_remove_handle($mh, $ch);
    curl_close($ch);

    $resp_data = json_decode($resp, true);
    $ok = $http_code === 200 && ($resp_data['success'] ?? false);

    if ($ok) {
        $sms_sent++;
    } else {
        $err = $resp_data['message'] ?? $resp_data['error'] ?? null;
        if (is_array($err)) $err = json_encode($err);
        if (!$err) $err = "HTTP $http_code";
        $errors[] = "{$r['name']} ({$phone}): $err";
    }

    // Log
    $rname  = $conn->real_escape_string($r['name']);
    $rtype  = $conn->real_escape_string($r['type'] ?? $recipient_type);
    $rmsg   = $conn->real_escape_string($msg_trim);
    $rphone = $conn->real_escape_string($phone);
    $status = $ok ? 'sent' : 'failed';
    $conn->query("INSERT INTO sms_log (recipient_name, recipient_type, recipient_phone, message, status, sent_at)
                  VALUES ('$rname', '$rtype', '$rphone', '$rmsg', '$status', NOW())");
}

curl_multi_close($mh);

if ($sms_sent === 0 && !empty($errors)) {
    json_error('Failed to send. ' . implode(' | ', array_slice($errors, 0, 3)));
}

json_ok([
    'message'  => "$sms_sent SMS sent successfully." . (!empty($errors) ? ' ' . count($errors) . ' failed.' : ''),
    'sms_sent' => $sms_sent,
    'errors'   => $errors,
]);
