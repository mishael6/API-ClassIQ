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
    if (!$row)          json_error('Recipient not found.');
    if (empty($row['phone'])) json_error('This classrep has no phone number on record.');
    $recipients[] = $row;
}

if (empty($recipients)) json_error('No recipients with phone numbers found.');

// ── Payloqa config ────────────────────────────────────────────
$payloqa_key    = getenv('PAYLOQA_API_KEY') ?: '';
$payloqa_sender = getenv('PAYLOQA_SENDER')  ?: 'ClassIQ';

if (!$payloqa_key) json_error('SMS service not configured. Add PAYLOQA_API_KEY to environment variables.');

$sms_sent = 0;
$errors   = [];

foreach ($recipients as $r) {
    // Format Ghana phone number → international format
    $phone = preg_replace('/\D/', '', $r['phone']);
    if (strlen($phone) === 10 && str_starts_with($phone, '0')) {
        $phone = '233' . substr($phone, 1);
    } elseif (strlen($phone) === 9) {
        $phone = '233' . $phone;
    }

    $sms_text = substr($message, 0, 155);

    $payload = json_encode([
        'recipient' => $phone,
        'sender'    => $payloqa_sender,
        'message'   => $sms_text,
    ]);

    $ch = curl_init('https://api.payloqa.com/v1/sms/send');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $payloqa_key,
        ],
        CURLOPT_TIMEOUT => 15,
    ]);

    $resp      = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $resp_data = json_decode($resp, true);

    if ($http_code === 200 && ($resp_data['status'] ?? '') === 'success') {
        $sms_sent++;
    } else {
        $errors[] = "SMS to {$r['name']} ({$phone}) failed: " . ($resp_data['message'] ?? "HTTP $http_code");
    }
}

if ($sms_sent === 0) {
    json_error('Failed to send SMS. ' . implode('. ', $errors));
}

json_ok([
    'message'  => "$sms_sent SMS sent successfully." . (empty($errors) ? '' : ' Some failed.'),
    'sms_sent' => $sms_sent,
    'errors'   => $errors,
]);
