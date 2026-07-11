<?php
// api/push/history.php — push notification log for admin
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

ensure_push_tables($conn);

$limit  = min((int)($_GET['limit'] ?? 20), 100);
$offset = (int)($_GET['offset'] ?? 0);

$total = (int)($conn->query("SELECT COUNT(*) AS c FROM push_log")->fetch_assoc()['c'] ?? 0);
$rows  = $conn->query("SELECT * FROM push_log ORDER BY sent_at DESC LIMIT $limit OFFSET $offset")->fetch_all(MYSQLI_ASSOC);

$subs = (int)($conn->query("SELECT COUNT(*) AS c FROM push_subscriptions")->fetch_assoc()['c'] ?? 0);

json_ok(['logs' => $rows, 'total' => $total, 'active_subscriptions' => $subs]);
