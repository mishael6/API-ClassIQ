<?php
// api/ai/subscribe.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$student_id = (int)($body['student_id'] ?? 0);
$phone      = trim($body['phone']       ?? '');
$network    = trim($body['network']     ?? 'MTN');

if (!$student_id) json_error('Student ID required.');
if (!$phone)      json_error('Phone number required.');

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

// Get dynamic price from settings
$price_row = $conn->query("SELECT setting_value FROM ai_settings WHERE setting_key = 'subscription_price' LIMIT 1")->fetch_assoc();
$amount    = (float)($price_row['setting_value'] ?? 30.00);

$reference   = 'SIX-' . $student_id . '-' . time();
$payloqa_key = getenv('PAYLOQA_API_KEY');
if (!$payloqa_key) json_error('Payment service not configured.');

$payloqa_payload = json_encode([
    'amount'       => $amount,
    'currency'     => 'GHS',
    'phone'        => $phone,
    'network'      => $network,
    'reference'    => $reference,
    'description'  => 'Six AI Study Assistant - Monthly Unlimited',
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
    json_error($data['message'] ?? 'Payment initiation failed.');
}

// Save pending subscription
$start = date('Y-m-d');
$end   = date('Y-m-d', strtotime('+1 month'));
$ins   = $conn->prepare("INSERT INTO ai_subscriptions (student_id, start_date, end_date, amount, payment_reference, status) VALUES (?, ?, ?, ?, ?, 'pending')");
$ins->bind_param('issds', $student_id, $start, $end, $amount, $reference);
$ins->execute();

json_ok([
    'message'   => 'Payment prompt sent to your phone. Approve the MoMo request to activate Six unlimited.',
    'reference' => $reference,
    'amount'    => $amount,
]);