<?php
// api/push/helpers.php — Web Push subscription storage & sending (no composer)

/** Add a column only if it does not exist (works on older MySQL/MariaDB). */
function ensure_column(mysqli $conn, string $table, string $column, string $definition): void {
    $safe_table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safe_col   = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result     = $conn->query("SHOW COLUMNS FROM `{$safe_table}` LIKE '{$safe_col}'");
    if ($result && $result->num_rows === 0) {
        $conn->query("ALTER TABLE `{$safe_table}` ADD COLUMN {$definition}");
    }
}

function ensure_push_tables(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS push_subscriptions (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        user_id       INT          NOT NULL,
        user_role     VARCHAR(20)  NOT NULL,
        endpoint      TEXT         NOT NULL,
        p256dh        VARCHAR(255) NOT NULL,
        auth          VARCHAR(255) NOT NULL,
        user_agent    VARCHAR(500) NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_endpoint (endpoint(255)),
        INDEX idx_user (user_id, user_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS push_log (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        title        VARCHAR(255) NOT NULL,
        body         TEXT         NOT NULL,
        sent_count   INT          NOT NULL DEFAULT 0,
        failed_count INT          NOT NULL DEFAULT 0,
        message_type VARCHAR(20)  NULL DEFAULT 'manual',
        sent_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    ensure_column($conn, 'push_log', 'message_type', "message_type VARCHAR(20) NULL DEFAULT 'manual'");
}

function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string {
    $pad = (4 - strlen($data) % 4) % 4;
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', $pad));
}

/** A valid P-256 public key is 65 bytes starting with 0x04 */
function vapid_public_key_valid(string $b64): bool {
    $b64 = trim($b64);
    if ($b64 === '') return false;
    $raw = b64url_decode($b64);
    return strlen($raw) === 65 && $raw[0] === "\x04";
}

function vapid_private_key_valid(string $b64): bool {
    $raw = b64url_decode(trim($b64));
    return strlen($raw) === 32;
}

/** Generate a guaranteed-valid VAPID key pair */
function generate_vapid_key_pair(): array {
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $key = openssl_pkey_new([
            'curve_name'       => 'prime256v1',
            'private_key_type' => OPENSSL_KEYTYPE_EC,
        ]);
        if (!$key) continue;

        $details = openssl_pkey_get_details($key);
        if (!isset($details['ec']['x'], $details['ec']['y'], $details['ec']['d'])) continue;

        $priv = str_pad($details['ec']['d'], 32, "\x00", STR_PAD_LEFT);
        $pub  = "\x04"
              . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
              . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);

        $public_b64  = b64url_encode($pub);
        $private_b64 = b64url_encode($priv);

        if (vapid_public_key_valid($public_b64) && vapid_private_key_valid($private_b64)) {
            return [
                'public'  => $public_b64,
                'private' => $private_b64,
                'subject' => 'mailto:admin@classiq.app',
            ];
        }
    }
    return [];
}

function sanitize_vapid_env(string $value): string {
    $value = trim($value);
    // Fix copy-paste like "VAPID_PUBLIC_KEY=BExx..."
    if (preg_match('/^VAPID_(PUBLIC|PRIVATE)_KEY=(.+)$/i', $value, $m)) {
        $value = trim($m[2]);
    }
    $value = trim($value, " \t\n\r\0\x0B\"'");
    // Strip accidental spaces/newlines inside the key value
    return preg_replace('/\s+/', '', $value);
}

function asn1_length(int $length): string {
    if ($length < 0x80) {
        return chr($length);
    }
    $bytes = '';
    $n = $length;
    while ($n > 0) {
        $bytes = chr($n & 0xff) . $bytes;
        $n >>= 8;
    }
    return chr(0x80 | strlen($bytes)) . $bytes;
}

function asn1_read_length(string $data, int &$pos): ?int {
    if ($pos >= strlen($data)) return null;
    $len = ord($data[$pos++]);
    if ($len & 0x80) {
        $nb = $len & 0x7f;
        if ($nb === 0 || $nb > 4 || ($pos + $nb) > strlen($data)) return null;
        $len = 0;
        for ($i = 0; $i < $nb; $i++) {
            $len = ($len << 8) | ord($data[$pos++]);
        }
    }
    return $len;
}

function asn1_octet_string(string $bytes): string {
    return "\x04" . asn1_length(strlen($bytes)) . $bytes;
}

function asn1_bit_string(string $bytes): string {
    $payload = "\x00" . $bytes;
    return "\x03" . asn1_length(strlen($payload)) . $payload;
}

function asn1_sequence(string $content): string {
    return "\x30" . asn1_length(strlen($content)) . $content;
}

/** Build SEC1 ECPrivateKey DER (optionally with public point for OpenSSL 3). */
function build_ec_private_key_der(string $private_raw, string $public_raw = ''): string {
    $oid = hex2bin('06082a8648ce3d030107'); // ecPublicKey + prime256v1

    $body  = "\x02\x01\x01"; // version = 1
    $body .= asn1_octet_string($private_raw);
    $body .= "\xa0" . asn1_length(strlen($oid)) . $oid;

    if ($public_raw !== '' && strlen($public_raw) === 65 && $public_raw[0] === "\x04") {
        $pub = asn1_bit_string($public_raw);
        $body .= "\xa1" . asn1_length(strlen($pub)) . $pub;
    }

    return asn1_sequence($body);
}

function vapid_private_to_pem(string $private_b64, string $public_b64 = ''): string {
    $raw = b64url_decode($private_b64);
    if (strlen($raw) !== 32) return '';

    $public_raw = '';
    if ($public_b64 !== '' && vapid_public_key_valid($public_b64)) {
        $public_raw = b64url_decode($public_b64);
    }

    $der = build_ec_private_key_der($raw, $public_raw);
    return "-----BEGIN EC PRIVATE KEY-----\n"
         . chunk_split(base64_encode($der), 64, "\n")
         . "-----END EC PRIVATE KEY-----\n";
}

/** PKCS#8 wrapper — some OpenSSL builds prefer this over SEC1. */
function vapid_private_to_pkcs8_pem(string $private_b64, string $public_b64 = ''): string {
    $raw = b64url_decode($private_b64);
    if (strlen($raw) !== 32) return '';

    $public_raw = '';
    if ($public_b64 !== '' && vapid_public_key_valid($public_b64)) {
        $public_raw = b64url_decode($public_b64);
    }

    $ec_private = build_ec_private_key_der($raw, $public_raw);
    $algo_id    = hex2bin('301306072a8648ce3d020106082a8648ce3d030107');
    $body       = "\x02\x01\x00" . $algo_id . asn1_octet_string($ec_private);
    $der        = asn1_sequence($body);

    return "-----BEGIN PRIVATE KEY-----\n"
         . chunk_split(base64_encode($der), 64, "\n")
         . "-----END PRIVATE KEY-----\n";
}

function vapid_load_private_key(string $private_b64, string $public_b64 = '') {
    foreach ([
        vapid_private_to_pem($private_b64, $public_b64),
        vapid_private_to_pkcs8_pem($private_b64, $public_b64),
        vapid_private_to_pem($private_b64),
        vapid_private_to_pkcs8_pem($private_b64),
    ] as $pem) {
        if (!$pem) continue;
        $key = openssl_pkey_get_private($pem);
        if ($key) return $key;
    }
    return false;
}

function create_vapid_jwt(string $audience, string $subject, string $private_b64, string $public_b64 = ''): string {
    $header  = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 43200,
        'sub' => $subject,
    ]));

    $key = vapid_load_private_key($private_b64, $public_b64);
    if (!$key) return '';

    $data = "$header.$payload";
    $der_sig = '';
    if (!openssl_sign($data, $der_sig, $key, OPENSSL_ALGO_SHA256)) {
        return '';
    }

    $sig = der_to_raw_ecdsa($der_sig);
    if (!$sig) return '';

    return "$data." . b64url_encode($sig);
}

function der_to_raw_ecdsa(string $der): ?string {
    $pos = 0;
    if (($der[$pos] ?? '') !== "\x30") return null;
    $pos++;
    if (asn1_read_length($der, $pos) === null) return null;

    if (($der[$pos] ?? '') !== "\x02") return null;
    $pos++;
    $r_len = asn1_read_length($der, $pos);
    if ($r_len === null || ($pos + $r_len) > strlen($der)) return null;
    $r = substr($der, $pos, $r_len);
    $pos += $r_len;

    if (($der[$pos] ?? '') !== "\x02") return null;
    $pos++;
    $s_len = asn1_read_length($der, $pos);
    if ($s_len === null || ($pos + $s_len) > strlen($der)) return null;
    $s = substr($der, $pos, $s_len);

    $r = ltrim($r, "\x00");
    $s = ltrim($s, "\x00");
    if (strlen($r) > 32 || strlen($s) > 32) return null;

    return str_pad($r, 32, "\x00", STR_PAD_LEFT) . str_pad($s, 32, "\x00", STR_PAD_LEFT);
}

/** Admin/diagnostic: verify env keys can produce a VAPID JWT. */
function vapid_signing_self_test(array $keys): array {
    $jwt = create_vapid_jwt('https://fcm.googleapis.com', $keys['subject'], $keys['private'], $keys['public']);
    return [
        'can_sign'       => $jwt !== '',
        'pair_valid'     => vapid_keys_are_pair($keys['public'], $keys['private']),
        'using_defaults' => $keys['using_defaults'] ?? false,
        'public_len'     => strlen(b64url_decode($keys['public'])),
        'private_len'    => strlen(b64url_decode($keys['private'])),
    ];
}

function vapid_public_from_private(string $private_b64, string $public_b64 = ''): string {
    $key = vapid_load_private_key($private_b64, $public_b64);
    if (!$key) return '';
    $details = openssl_pkey_get_details($key);
    if (!isset($details['ec']['x'], $details['ec']['y'])) return '';

    $pub = "\x04"
         . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
         . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);
    return b64url_encode($pub);
}

function vapid_keys_are_pair(string $public_b64, string $private_b64): bool {
    if (!vapid_public_key_valid($public_b64) || !vapid_private_key_valid($private_b64)) {
        return false;
    }
    return vapid_public_from_private($private_b64) === $public_b64;
}

function get_vapid_keys(): array {
    // Known-good fallback pair (web-push standard test keys)
    $defaults = [
        'public'  => 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        'private' => 'Vk6P7jL0rGzpPPGT8vfc_xoKd6niE3P92g8N-9hm3gc',
        'subject' => 'mailto:admin@classiq.app',
    ];

    $public  = sanitize_vapid_env(getenv('VAPID_PUBLIC_KEY')  ?: '');
    $private = sanitize_vapid_env(getenv('VAPID_PRIVATE_KEY') ?: '');
    $subject = sanitize_vapid_env(getenv('VAPID_SUBJECT')   ?: '');

    $using_defaults = false;
    if (!vapid_keys_are_pair($public, $private)) {
        $public         = $defaults['public'];
        $private        = $defaults['private'];
        $using_defaults = true;
    }

    if (!$subject) $subject = $defaults['subject'];

    return [
        'public'         => $public,
        'private'        => $private,
        'subject'        => $subject,
        'using_defaults' => $using_defaults,
        'pair_valid'     => true,
    ];
}

function push_send_error_hint(int $code, string $body = ''): string {
    if ($code === 401) {
        return 'VAPID keys do not match this device. In Render, set BOTH VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY from Admin → Generate VAPID Keys (paste values only), redeploy, then have the student disable and re-enable push in Settings.';
    }
    if ($code === 410 || $code === 404) {
        return 'Subscription expired. The student should turn push off and on again in Settings.';
    }
    if ($code === 0) {
        return 'Could not reach the push service (network error).';
    }
    $snippet = trim(substr($body, 0, 120));
    return $snippet
        ? "Push service rejected the message (HTTP $code): $snippet"
        : "Push service rejected the message (HTTP $code).";
}

function hkdf(string $ikm, int $length, string $info = '', string $salt = ''): string {
    $prk = hash_hmac('sha256', $ikm, $salt ?: str_repeat("\x00", 32), true);
    $okm = '';
    $t   = '';
    for ($i = 1; strlen($okm) < $length; $i++) {
        $t    = hash_hmac('sha256', $t . $info . chr($i), $prk, true);
        $okm .= $t;
    }
    return substr($okm, 0, $length);
}

function encrypt_push_payload(string $payload, string $p256dh_b64, string $auth_b64): ?array {
    $user_public  = b64url_decode($p256dh_b64);
    $user_auth    = b64url_decode($auth_b64);

    $local_key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$local_key) return null;

    $local_details = openssl_pkey_get_details($local_key);
    $local_public  = "\x04" . str_pad($local_details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
                   . str_pad($local_details['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    $user_pem = "-----BEGIN PUBLIC KEY-----\n"
              . chunk_split(base64_encode(
                  "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00\x04"
                  . substr($user_public, 1)
              ), 64, "\n")
              . "-----END PUBLIC KEY-----\n";

    $user_key = openssl_pkey_get_public($user_pem);
    if (!$user_key) return null;

    $shared = '';
    if (!openssl_pkey_derive($user_key, $local_key, $shared)) return null;

    $salt         = random_bytes(16);
    $key_info     = "WebPush: info\x00" . $user_public . $local_public;
    $ikm          = hkdf($shared, 32, $key_info, $user_auth);
    $cek          = hkdf($ikm, 16, "Content-Encoding: aes128gcm\x00", $salt);
    $nonce        = hkdf($ikm, 12, "Content-Encoding: nonce\x00", $salt);

    $record_size  = 4096;
    $pad_len      = 0;
    $plain        = $payload . str_repeat("\x00", $pad_len) . chr($pad_len);
    $tag          = '';
    $ciphertext   = openssl_encrypt($plain, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '');
    if ($ciphertext === false) return null;

    $rs_bytes = pack('N', $record_size);
    $body     = $salt . $rs_bytes . chr(strlen($local_public)) . $local_public . $ciphertext . $tag;

    return ['body' => $body, 'salt' => $salt, 'local_public' => $local_public];
}

function send_web_push(array $subscription, array $payload_data, array $vapid): array {
    $endpoint = $subscription['endpoint'] ?? '';
    $p256dh   = $subscription['keys']['p256dh'] ?? '';
    $auth     = $subscription['keys']['auth'] ?? '';
    if (!$endpoint || !$p256dh || !$auth) {
        return ['ok' => false, 'http_code' => 0, 'hint' => 'Invalid subscription data in database.'];
    }

    $parsed   = parse_url($endpoint);
    $audience = ($parsed['scheme'] ?? 'https') . '://' . ($parsed['host'] ?? '');

    $jwt = create_vapid_jwt($audience, $vapid['subject'], $vapid['private'], $vapid['public']);
    if (!$jwt) {
        $test = vapid_signing_self_test($vapid);
        $hint = 'Could not sign VAPID token on server.';
        if (!$test['pair_valid']) {
            $hint = 'VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY do not match. Generate a new pair in Admin → Push → Generate VAPID Keys and paste BOTH values into Render (no quotes, no labels).';
        } elseif ($test['using_defaults']) {
            $hint = 'Render env keys were invalid — server fell back to defaults. Set valid matching VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY, redeploy, then re-enable push on the phone.';
        } else {
            $hint = 'OpenSSL could not sign with VAPID_PRIVATE_KEY. Regenerate keys in Admin, update Render, redeploy.';
        }
        return ['ok' => false, 'http_code' => 0, 'hint' => $hint];
    }

    $payload_json = json_encode($payload_data);
    $encrypted    = encrypt_push_payload($payload_json, $p256dh, $auth);
    if (!$encrypted) {
        return ['ok' => false, 'http_code' => 0, 'hint' => 'Could not encrypt notification payload.'];
    }

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => $encrypted['body'],
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'TTL: 86400',
            'Urgency: normal',
            "Authorization: vapid t=$jwt, k={$vapid['public']}",
        ],
        CURLOPT_TIMEOUT => 15,
    ]);

    $response  = curl_exec($ch);
    $http_code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curl_err  = curl_error($ch);
    curl_close($ch);

    if (in_array($http_code, [200, 201, 204])) {
        return ['ok' => true, 'http_code' => $http_code];
    }

    $hint = $curl_err
        ? "Network error: $curl_err"
        : push_send_error_hint($http_code, (string)$response);

    return [
        'ok'        => false,
        'http_code' => $http_code,
        'hint'      => $hint,
        'expired'   => in_array($http_code, [404, 410]),
    ];
}

function save_push_subscription(mysqli $conn, int $user_id, string $user_role, array $sub, string $ua = ''): void {
    ensure_push_tables($conn);

    $endpoint = $sub['endpoint'] ?? '';
    $p256dh   = $sub['keys']['p256dh'] ?? '';
    $auth     = $sub['keys']['auth'] ?? '';

    if (!$endpoint || !$p256dh || !$auth) json_error('Invalid push subscription.');

    $stmt = $conn->prepare("
        INSERT INTO push_subscriptions (user_id, user_role, endpoint, p256dh, auth, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            user_id = VALUES(user_id), user_role = VALUES(user_role),
            p256dh = VALUES(p256dh), auth = VALUES(auth),
            user_agent = VALUES(user_agent), updated_at = NOW()
    ");
    $stmt->bind_param('isssss', $user_id, $user_role, $endpoint, $p256dh, $auth, $ua);
    $stmt->execute();
}

function remove_push_subscription(mysqli $conn, string $endpoint): void {
    ensure_push_tables($conn);
    $stmt = $conn->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
    $stmt->bind_param('s', $endpoint);
    $stmt->execute();
}

function broadcast_push(mysqli $conn, string $title, string $body, ?string $role = null, ?int $user_id = null, string $type = 'manual'): array {
    ensure_push_tables($conn);
    $vapid = get_vapid_keys();

    $sql = "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE 1=1";
    $params = [];
    $types  = '';

    if ($role)     { $sql .= " AND user_role = ?"; $params[] = $role;     $types .= 's'; }
    if ($user_id)  { $sql .= " AND user_id = ?";  $params[] = $user_id;  $types .= 'i'; }

    if ($params) {
        $stmt = $conn->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    } else {
        $rows = $conn->query($sql)->fetch_all(MYSQLI_ASSOC);
    }

    $sent   = 0;
    $failed = 0;
    $errors = [];
    $payload = [
        'title' => $title,
        'body'  => $body,
        'icon'  => '/assets/icon.png',
        'url'   => '/',
    ];

    foreach ($rows as $row) {
        $sub = [
            'endpoint' => $row['endpoint'],
            'keys'     => ['p256dh' => $row['p256dh'], 'auth' => $row['auth']],
        ];
        $push_result = send_web_push($sub, $payload, $vapid);
        if (!empty($push_result['ok'])) {
            $sent++;
        } else {
            $failed++;
            if (!empty($push_result['hint'])) {
                $errors[] = $push_result['hint'];
            }
            if (!empty($push_result['expired'])) {
                $del = $conn->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
                $del->bind_param('s', $row['endpoint']);
                $del->execute();
            }
        }
    }

    $title_e = $conn->real_escape_string($title);
    $body_e  = $conn->real_escape_string($body);
    $type_e  = $conn->real_escape_string($type);
    $conn->query("INSERT INTO push_log (title, body, sent_count, failed_count, message_type, sent_at)
                  VALUES ('$title_e', '$body_e', $sent, $failed, '$type_e', NOW())");

    return [
        'sent'   => $sent,
        'failed' => $failed,
        'total'  => count($rows),
        'errors' => array_values(array_unique($errors)),
    ];
}

function notify_student_push(mysqli $conn, int $student_id, string $title, string $body, string $type = 'attendance'): void {
    broadcast_push($conn, $title, $body, 'student', $student_id, $type);
}

function notify_all_students_push(mysqli $conn, string $title, string $body): array {
    return broadcast_push($conn, $title, $body, 'student');
}
