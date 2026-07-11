<?php
// api/push/generate_vapid_keys.php — one-time VAPID key generator (admin only)
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$pair = generate_vapid_key_pair();
if (empty($pair)) {
    json_error('Could not generate valid VAPID keys. Ensure OpenSSL EC support is enabled.');
}

json_ok([
    'message' => 'Copy each VALUE (not the label) into Render Environment Variables, then redeploy.',
    'VAPID_PUBLIC_KEY'  => $pair['public'],
    'VAPID_PRIVATE_KEY' => $pair['private'],
    'VAPID_SUBJECT'     => 'mailto:classiq660@gmail.com',
]);
