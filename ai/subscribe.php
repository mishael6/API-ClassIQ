<?php
// api/ai/subscribe.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$student_id = (int)($body['student_id'] ?? 0);
$phone      = trim($body['phone']       ?? '');
$network    = trim($body['network']     ?? 'MTN'); // MTN, Vodafone, AirtelTigo

if (!$student_id) json_error('Student ID required.');
if (!$phone)      json_error('Phone number required.');

// Check already subscribed
$today = date('Y-m-d');
$sub = $conn->prepare("SELECT id, end_date FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= ? LIMIT 1");
$sub->bind_param('is', $student_id, $today);
$sub->execute();
$existing = $sub->get_result()->fetch_assoc();
if ($existing) {
    json_error("You already have an active subscription until {$existing['end_date']}.");
}

$amount    = 30.00;
$reference = 'CLASSIQ-AI-' . $student_id . '-' . time();

// Payloqa payment request
$payloqa_key = getenv('PAYLOQA_API_KEY');
if (!$payloqa_key) json_error('Payment service not configured.');

$payloqa_payload = json_encode([
    'amount'      => $amount,
    'currency'    => 'GHS',
    'phone'       => $phone,
    'network'     => $network,
    'reference'   => $reference,
    'description' => 'ClassIQ AI Study - Monthly Unlimited',
    'callback_url' => getenv('APP_URL') . '/api/ai/payment_callback.php',
]);

$ch = curl_init('https://api.payloqa.com/v1/collections/mobile-money');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payloqa_payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    "Authorization: Bearer $payloqa_key",
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$response) json_error('Payment service unreachable. Try again.');

$data = json_decode($response, true);

if ($http_code !== 200 && $http_code !== 201) {
    $err = $data['message'] ?? 'Payment initiation failed.';
    json_error($err);
}

// Save pending subscription
$start = date('Y-m-d');
$end   = date('Y-m-d', strtotime('+1 month'));

$ins = $conn->prepare("INSERT INTO ai_subscriptions (student_id, start_date, end_date, amount, payment_reference, status) VALUES (?, ?, ?, ?, ?, 'pending')");
$ins->bind_param('issds', $student_id, $start, $end, $amount, $reference);
$ins->execute();

json_ok([
    'message'   => 'Payment prompt sent to your phone. Approve the MoMo request.',
    'reference' => $reference,
]);