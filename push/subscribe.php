<?php
// api/push/subscribe.php — save push subscription for logged-in user
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = get_body();
$sub  = $body['subscription'] ?? null;

if (!$sub || empty($sub['endpoint']) || empty($sub['keys'])) {
    json_error('Invalid subscription data.');
}

// Try student auth first, then classrep
$token = get_bearer_token();
if (!$token) json_error('Unauthorized', 401);

$user_id   = 0;
$user_role = '';

$stmt = $conn->prepare("SELECT id FROM students WHERE session_token = ? LIMIT 1");
$stmt->bind_param('s', $token);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
if ($row) {
    $user_id   = (int)$row['id'];
    $user_role = 'student';
} else {
    $stmt = $conn->prepare("SELECT id, role FROM users WHERE session_token = ? AND status = 'approved' LIMIT 1");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if ($row) {
        $user_id   = (int)$row['id'];
        $user_role = 'classrep';
    }
}

if (!$user_id) {
    json_error('Session expired. Log out and log in again, then enable push.', 401);
}

$ua = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
save_push_subscription($conn, $user_id, $user_role, $sub, $ua);

$count = (int)($conn->query("SELECT COUNT(*) AS c FROM push_subscriptions")->fetch_assoc()['c'] ?? 0);

json_ok([
    'message'              => 'Push notifications enabled.',
    'active_subscriptions' => $count,
]);
