<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$payment_id = trim($_GET['payment_id'] ?? '');
$student_id = (int)($_GET['student_id'] ?? 0);
$check_only = (bool)($_GET['check_only'] ?? false);

if (!$student_id) json_error('Student ID required.');

// Check if already subscribed
$sub = $conn->prepare("SELECT status, end_date FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= CURDATE() LIMIT 1");
$sub->bind_param('i', $student_id);
$sub->execute();
$row = $sub->get_result()->fetch_assoc();

if ($check_only) {
    json_ok(['subscribed' => !empty($row), 'end_date' => $row['end_date'] ?? null]);
}

if ($row) {
    json_ok(['status' => 'completed', 'message' => 'Subscription active!', 'end_date' => $row['end_date']]);
}

if (!$payment_id) json_error('Payment ID required.');

// Check pending subscription
$pending = $conn->prepare("SELECT status FROM ai_subscriptions WHERE payment_reference = ? AND student_id = ? LIMIT 1");
$pending->bind_param('si', $payment_id, $student_id);
$pending->execute();
$pendingRow = $pending->get_result()->fetch_assoc();

if ($pendingRow && $pendingRow['status'] === 'active') {
    json_ok(['status' => 'completed', 'message' => 'Subscription activated!']);
}

json_ok(['status' => 'pending', 'message' => 'Payment pending.']);