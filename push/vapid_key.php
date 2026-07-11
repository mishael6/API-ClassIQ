<?php
// api/push/vapid_key.php — return public VAPID key for client subscription
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$keys = get_vapid_keys();
json_ok(['publicKey' => $keys['public']]);
