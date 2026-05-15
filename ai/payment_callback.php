<?php
// api/ai/payment_callback.php
require_once __DIR__ . '/../bootstrap.php';

// Always return 200 to Payloqa
http_response_code(200);

$body   = get_body();
$event  = trim($body['event']  ?? '');
$status = trim($body['data']['status'] ?? $body['status'] ?? '');
$payment_id = trim($body['data']['payment_id'] ?? $body['payment_id'] ?? '');

// Log for debugging
$log = $conn->prepare("INSERT INTO error_logs (message, created_at) VALUES (?, NOW())");
$log_msg = "Payloqa webhook: event=$event status=$status payment_id=$payment_id";
$log->bind_param('s', $log_msg);
$log->execute();

if (!$payment_id) {
    echo json_encode(['received' => true]);
    exit;
}

if ($status === 'completed') {
    $upd = $conn->prepare("UPDATE ai_subscriptions SET status = 'active' WHERE payment_reference = ? AND status = 'pending'");
    $upd->bind_param('s', $payment_id);
    $upd->execute();
} elseif (in_array($status, ['failed', 'cancelled'])) {
    $del = $conn->prepare("DELETE FROM ai_subscriptions WHERE payment_reference = ? AND status = 'pending'");
    $del->bind_param('s', $payment_id);
    $del->execute();
}

echo json_encode(['received' => true]);
exit;