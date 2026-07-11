<?php
// api/push/vapid_key.php — return public VAPID key for client subscription
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$keys = get_vapid_keys();

if (!vapid_public_key_valid($keys['public'])) {
    json_error('Invalid VAPID public key on server. Regenerate keys in Admin → Send SMS → Generate VAPID Keys.', 500);
}

json_ok([
    'publicKey'      => $keys['public'],
    'usingDefaults'  => $keys['using_defaults'] ?? false,
]);
