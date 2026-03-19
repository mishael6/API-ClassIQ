<?php
// api/admin/send_message.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body           = get_body();
$recipient_type = $body['recipient_type'] ?? 'classrep';
$recipient_id   = (int)($body['recipient_id'] ?? 0);
$message        = trim($body['message'] ?? '');

if (!$message) json_error('Message is required.');

// ── Fetch recipients ──────────────────────────────────────────
$recipients = [];
if ($recipient_type === 'all') {
    $rows = $conn->query("
        SELECT id, name, phone FROM users
        WHERE status = 'approved' AND phone != '' AND phone IS NOT NULL
        ORDER BY name
    ")->fetch_all(MYSQLI_ASSOC);
    $recipients = $rows;
} else {
    if (!$recipient_id) json_error('Please select a recipient.');
    $stmt = $conn->prepare("SELECT id, name, phone FROM users WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $recipient_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row)                json_error('Recipient not found.');
    if (empty($row['phone'])) json_error("This classrep has no phone number on record.");
    $recipients[] = $row;
}

if (empty($recipients)) json_error('No recipients with phone numbers found.');

// ── Payloqa config ────────────────────────────────────────────
$api_key     = getenv('PAYLOQA_API_KEY')     ?: 'pk_live_of502pjkel';
$platform_id = getenv('PAYLOQA_PLATFORM_ID') ?: 'plat_xvadsq3rx0f';
$sender_id   = getenv('PAYLOQA_SENDER')      ?: 'ClassIQ';

$sms_sent = 0;
$errors   = [];

foreach ($recipients as $r) {
    // Format to E.164
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
        'message'            => substr($message, 0, 155),
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

    if ($http_code === 200 && ($resp_data['success'] ?? false)) {
        $sms_sent++;
    } else {
        // Recursively extract error message from nested arrays/objects
        $err = $resp_data['message']
            ?? $resp_data['error']
            ?? $resp_data['data']['message']
            ?? $resp_data['data']['error']
            ?? null;

        // If still array, JSON encode it so we can read it
        if (is_array($err)) $err = json_encode($err);
        if (!$err)          $err = json_encode($resp_data) ?: "HTTP $http_code";

        $errors[] = "{$r['name']} ({$phone}): $err";
    }
}

if ($sms_sent === 0) {
    json_error('Failed to send. ' . implode(' | ', $errors));
}

json_ok([
    'message'  => "$sms_sent SMS sent successfully." . (!empty($errors) ? ' Some failed.' : ''),
    'sms_sent' => $sms_sent,
    'errors'   => $errors,
]);
