<?php
/**
 * Generate VAPID keys locally — no login required.
 * Run: php api/push/generate_keys_local.php
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

// Validate
$decoded = base64_decode(strtr($public_key, '-_', '+/') . str_repeat('=', (4 - strlen($public_key) % 4) % 4));
if (strlen($decoded) !== 65 || $decoded[0] !== "\x04") {
    fwrite(STDERR, "Error: Generated public key failed validation.\n");
    exit(1);
}

$subject = 'mailto:admin@classiq.app';

echo "\n=== ClassIQ VAPID Keys (validated) ===\n\n";
echo "Add these in Render → Environment → Add Variable:\n\n";
echo "Key:   VAPID_PUBLIC_KEY\nValue: $public_key\n\n";
echo "Key:   VAPID_PRIVATE_KEY\nValue: $private_key\n\n";
echo "Key:   VAPID_SUBJECT\nValue: $subject\n\n";
echo "IMPORTANT: Paste only the Value, not 'VAPID_PUBLIC_KEY='.\n\n";
