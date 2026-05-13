<?php
// api/ai/payment_callback.php
require_once __DIR__ . '/../bootstrap.php';

$body      = get_body();
$reference = trim($body['reference'] ?? '');
$status    = trim($body['status']    ?? '');

if (!$reference) json_error('Reference required.');

if ($status === 'success' || $status === 'successful') {
    $upd = $conn->prepare("UPDATE ai_subscriptions SET status = 'active' WHERE payment_reference = ?");
    $upd->bind_param('s', $reference);
    $upd->execute();
    json_ok(['message' => 'Subscription activated.']);
} else {
    $upd = $conn->prepare("DELETE FROM ai_subscriptions WHERE payment_reference = ? AND status = 'pending'");
    $upd->bind_param('s', $reference);
    $upd->execute();
    json_ok(['message' => 'Payment failed or cancelled.']);
}