<?php
// api/push/unsubscribe.php — remove push subscription
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$endpoint = trim($body['endpoint'] ?? '');

if (!$endpoint) json_error('Endpoint required.');

remove_push_subscription($conn, $endpoint);
json_ok(['message' => 'Push notifications disabled.']);
