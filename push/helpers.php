<?php
// api/push/helpers.php — Web Push subscription storage & sending (no composer)

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
        sent_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function b64url_decode(string $data): string {
    $pad = (4 - strlen($data) % 4) % 4;
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', $pad));
}

function get_vapid_keys(): array {
    return [
        'public'  => getenv('VAPID_PUBLIC_KEY')  ?: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
        'private' => getenv('VAPID_PRIVATE_KEY') ?: 'p92vj1WhvZ9Dk7mK3nL8xR4tY6wQ0sA2bC5dE7fG9hJ1',
        'subject' => getenv('VAPID_SUBJECT')   ?: 'mailto:admin@classiq.app',
    ];
}

function vapid_private_to_pem(string $private_b64): string {
    $raw = b64url_decode($private_b64);
    if (strlen($raw) !== 32) return '';

    $oid  = hex2bin('06082a8648ce3d030107');
    $pk   = "\x04" . str_repeat("\x00", 32) . "\xa1" . chr(4) . chr(34) . "\x04" . chr(32) . $raw;
    $seq  = "\x30" . chr(strlen($oid) + strlen($pk) + 2) . $oid . $pk;
    $der  = "\x30" . chr(strlen($seq) + 2) . "\x02\x01\x00" . $seq;

    return "-----BEGIN EC PRIVATE KEY-----\n"
         . chunk_split(base64_encode($der), 64, "\n")
         . "-----END EC PRIVATE KEY-----\n";
}

function create_vapid_jwt(string $audience, string $subject, string $private_b64): string {
    $header  = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 43200,
        'sub' => $subject,
    ]));

    $pem = vapid_private_to_pem($private_b64);
    $key = $pem ? openssl_pkey_get_private($pem) : false;
    if (!$key) return '';

    $data = "$header.$payload";
    openssl_sign($data, $der_sig, $key, OPENSSL_ALGO_SHA256);

    // Convert DER signature to raw R||S (64 bytes)
    $sig = der_to_raw_ecdsa($der_sig);
    if (!$sig) return '';

    return "$data." . b64url_encode($sig);
}

function der_to_raw_ecdsa(string $der): ?string {
    $pos = 0;
    if (ord($der[$pos++]) !== 0x30) return null;
    $len = ord($der[$pos++]);
    if ($len & 0x80) { $nb = $len & 0x7f; $len = 0; for ($i = 0; $i < $nb; $i++) $len = ($len << 8) | ord($der[$pos++]); }

    if (ord($der[$pos++]) !== 0x02) return null;
    $r_len = ord($der[$pos++]);
    $r = substr($der, $pos, $r_len); $pos += $r_len;

    if (ord($der[$pos++]) !== 0x02) return null;
    $s_len = ord($der[$pos++]);
    $s = substr($der, $pos, $s_len);

    $r = ltrim($r, "\x00");
    $s = ltrim($s, "\x00");
    return str_pad($r, 32, "\x00", STR_PAD_LEFT) . str_pad($s, 32, "\x00", STR_PAD_LEFT);
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

function send_web_push(array $subscription, array $payload_data, array $vapid): bool {
    $endpoint = $subscription['endpoint'] ?? '';
    $p256dh   = $subscription['keys']['p256dh'] ?? '';
    $auth     = $subscription['keys']['auth'] ?? '';
    if (!$endpoint || !$p256dh || !$auth) return false;

    $parsed   = parse_url($endpoint);
    $audience = ($parsed['scheme'] ?? 'https') . '://' . ($parsed['host'] ?? '');

    $jwt = create_vapid_jwt($audience, $vapid['subject'], $vapid['private']);
    if (!$jwt) return false;

    $payload_json = json_encode($payload_data);
    $encrypted    = encrypt_push_payload($payload_json, $p256dh, $auth);
    if (!$encrypted) return false;

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POSTFIELDS     => $encrypted['body'],
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'TTL: 86400',
            "Authorization: vapid t=$jwt, k={$vapid['public']}",
        ],
        CURLOPT_TIMEOUT => 15,
    ]);

    curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return in_array($http_code, [200, 201, 204]);
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

function broadcast_push(mysqli $conn, string $title, string $body, ?string $role = null, ?int $user_id = null): array {
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
        if (send_web_push($sub, $payload, $vapid)) {
            $sent++;
        } else {
            $failed++;
            $del = $conn->prepare("DELETE FROM push_subscriptions WHERE endpoint = ?");
            $del->bind_param('s', $row['endpoint']);
            $del->execute();
        }
    }

    $title_e = $conn->real_escape_string($title);
    $body_e  = $conn->real_escape_string($body);
    $conn->query("INSERT INTO push_log (title, body, sent_count, failed_count, sent_at)
                  VALUES ('$title_e', '$body_e', $sent, $failed, NOW())");

    return ['sent' => $sent, 'failed' => $failed, 'total' => count($rows)];
}

function notify_student_push(mysqli $conn, int $student_id, string $title, string $body): void {
    broadcast_push($conn, $title, $body, 'student', $student_id);
}

function notify_all_students_push(mysqli $conn, string $title, string $body): array {
    return broadcast_push($conn, $title, $body, 'student');
}
