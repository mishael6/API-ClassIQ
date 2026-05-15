<?php
// api/ai/check_payment.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$payment_id = trim($_GET['payment_id'] ?? '');
$student_id = (int)($_GET['student_id'] ?? 0);

if (!$payment_id || !$student_id) json_error('Payment ID and student ID required.');

$payloqa_key      = getenv('PAYLOQA_API_KEY');
$payloqa_platform = getenv('PAYLOQA_PLATFORM_ID');

// Check our DB first
$sub = $conn->prepare("SELECT status, end_date FROM ai_subscriptions WHERE payment_reference = ? AND student_id = ? LIMIT 1");
$sub->bind_param('si', $payment_id, $student_id);
$sub->execute();
$row = $sub->get_result()->fetch_assoc();

// If already active in our DB, return immediately
if ($row && $row['status'] === 'active') {
    json_ok(['status' => 'completed', 'message' => 'Subscription activated!', 'end_date' => $row['end_date']]);
}

// Otherwise check Payloqa directly
$ch = curl_init("https://payments.payloqa.com/api/v1/payments/$payment_id");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-API-Key: $payloqa_key",
    "X-Platform-Id: $payloqa_platform",
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$response) json_error('Could not check payment status.');

$data   = json_decode($response, true);
$status = $data['data']['status'] ?? 'pending';

// If completed on Payloqa but not yet in our DB, activate now
if ($status === 'completed' && $row && $row['status'] === 'pending') {
    $upd = $conn->prepare("UPDATE ai_subscriptions SET status = 'active' WHERE payment_reference = ?");
    $upd->bind_param('s', $payment_id);
    $upd->execute();

    json_ok(['status' => 'completed', 'message' => 'Subscription activated!']);
}

json_ok(['status' => $status, 'message' => $data['data']['message'] ?? 'Payment ' . $status]);