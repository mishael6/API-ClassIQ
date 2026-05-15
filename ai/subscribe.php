<?php
// api/ai/subscribe.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$student_id = (int)($body['student_id'] ?? 0);
$phone      = trim($body['phone']       ?? '');
$network    = strtolower(trim($body['network'] ?? 'mtn'));

if (!$student_id) json_error('Student ID required.');
if (!$phone)      json_error('Phone number required.');

// Normalize phone to E.164 format
$phone = preg_replace('/\D/', '', $phone);
if (strlen($phone) === 10 && $phone[0] === '0') {
    $phone = '233' . substr($phone, 1);
}
if (strlen($phone) !== 12) json_error('Invalid phone number. Use format: 0XXXXXXXXX');

// Check already subscribed
$sub = $conn->prepare("SELECT id, end_date FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= CURDATE() LIMIT 1");
$sub->bind_param('i', $student_id);
$sub->execute();
$existing = $sub->get_result()->fetch_assoc();
if ($existing) json_error("You already have an active subscription until {$existing['end_date']}.");

// Check free grant
$grant = $conn->prepare("SELECT id FROM ai_free_grants WHERE student_id = ? AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1");
$grant->bind_param('i', $student_id);
$grant->execute();
if ($grant->get_result()->num_rows > 0) json_error('You already have unlimited access granted by your institution.');

// Get price from settings
$price_row = $conn->query("SELECT setting_value FROM ai_settings WHERE setting_key = 'subscription_price' LIMIT 1")->fetch_assoc();
$amount    = (float)($price_row['setting_value'] ?? 30.00);

$payloqa_key        = getenv('PAYLOQA_API_KEY');
$payloqa_platform   = getenv('PAYLOQA_PLATFORM_ID');
$webhook_url        = getenv('APP_URL') . '/api/ai/payment_callback.php';

if (!$payloqa_key || !$payloqa_platform) json_error('Payment service not configured.');

$order_id  = 'SIX-' . $student_id . '-' . time();

$payloqa_payload = json_encode([
    'amount'         => $amount,
    'currency'       => 'GHS',
    'payment_method' => 'mobile_money',
    'phone_number'   => $phone,
    'network'        => $network,
    'offline'        => true,
    'payment_flow'   => 'direct',
    'webhook_url'    => $webhook_url,
    'metadata'       => [
        'order_reference' => $order_id,
        'student_id'      => $student_id,
        'type'            => 'six_subscription',
    ],
]);

$ch = curl_init('https://payments.payloqa.com/api/v1/payments/create');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payloqa_payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    "X-API-Key: $payloqa_key",
    "X-Platform-Id: $payloqa_platform",
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$response) json_error('Payment service unreachable. Try again.');

$data = json_decode($response, true);

if (!($data['success'] ?? false)) {
    json_error($data['message'] ?? 'Payment initiation failed.');
}

$payment_id = $data['data']['payment_id'] ?? null;
if (!$payment_id) json_error('Payment ID not returned. Try again.');

// Save pending subscription
$start = date('Y-m-d');
$end   = date('Y-m-d', strtotime('+1 month'));
$ins   = $conn->prepare("INSERT INTO ai_subscriptions (student_id, start_date, end_date, amount, payment_reference, status) VALUES (?, ?, ?, ?, ?, 'pending')");
$ins->bind_param('issds', $student_id, $start, $end, $amount, $payment_id);
$ins->execute();

json_ok([
    'message'    => 'Payment initiated! Approve the MoMo prompt on your phone to activate Six unlimited.',
    'payment_id' => $payment_id,
    'amount'     => $amount,
]);