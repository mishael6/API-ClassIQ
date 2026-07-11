<?php
/**
 * Generate VAPID keys locally — no login required.
 * Run from terminal:  php api/push/generate_keys_local.php
 */
function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

$key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
if (!$key) {
    fwrite(STDERR, "Error: OpenSSL could not generate EC keys.\n");
    exit(1);
}

$details = openssl_pkey_get_details($key);
$priv    = str_pad($details['ec']['d'], 32, "\x00", STR_PAD_LEFT);
$pub     = "\x04" . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
         . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);

$public_key  = b64url_encode($pub);
$private_key = b64url_encode($priv);
$subject     = 'mailto:admin@classiq.app';

echo "\n=== ClassIQ VAPID Keys ===\n\n";
echo "Copy these into Render → Environment Variables:\n\n";
echo "VAPID_PUBLIC_KEY\n  $public_key\n\n";
echo "VAPID_PRIVATE_KEY\n  $private_key\n\n";
echo "VAPID_SUBJECT\n  $subject\n\n";
echo "Keep the PRIVATE key secret. Never put it in the app or GitHub.\n\n";
