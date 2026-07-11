<?php
// api/push/vapid_status.php — diagnose VAPID key setup (admin only)
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/helpers.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$keys = get_vapid_keys();
$test = vapid_signing_self_test($keys);

$env_public  = sanitize_vapid_env(getenv('VAPID_PUBLIC_KEY')  ?: '');
$env_private = sanitize_vapid_env(getenv('VAPID_PRIVATE_KEY') ?: '');

json_ok([
    'env_keys_set'     => $env_public !== '' && $env_private !== '',
    'env_pair_valid'   => vapid_keys_are_pair($env_public, $env_private),
    'using_defaults'   => $keys['using_defaults'],
    'can_sign'         => $test['can_sign'],
    'public_key_valid' => vapid_public_key_valid($keys['public']),
    'private_key_valid'=> vapid_private_key_valid($keys['private']),
    'openssl_ec'       => in_array('prime256v1', openssl_get_curve_names() ?: [], true),
    'message'          => $test['can_sign']
        ? ($keys['using_defaults']
            ? 'Signing works but using DEFAULT keys — set your Render env vars.'
            : 'VAPID keys are valid and signing works.')
        : 'Signing FAILED — regenerate keys in Admin and update Render.',
]);
