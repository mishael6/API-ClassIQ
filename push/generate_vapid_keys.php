<?php
// api/push/generate_vapid_keys.php — one-time VAPID key generator (admin only)
// Run once, then set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in your environment.
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
if (!$key) json_error('Could not generate keys. Ensure OpenSSL EC support is enabled.');

$details = openssl_pkey_get_details($key);
$priv    = str_pad($details['ec']['d'], 32, "\x00", STR_PAD_LEFT);
$pub     = "\x04" . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
         . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);

json_ok([
    'message' => 'Set these as environment variables on your server, then delete or protect this endpoint.',
    'VAPID_PUBLIC_KEY'  => b64url_encode($pub),
    'VAPID_PRIVATE_KEY' => b64url_encode($priv),
    'VAPID_SUBJECT'     => 'mailto:classiq660@gmail.com',
]);
