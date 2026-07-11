<?php
// api/lib/sms_helpers.php — shared SMS sending with batch support

define('SMS_BATCH_SIZE', 25);
define('SMS_BATCH_DELAY_MS', 500);

/** Add a column only if it does not exist (works on older MySQL/MariaDB). */
function sms_ensure_column(mysqli $conn, string $table, string $column, string $definition): void {
    $safe_table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safe_col   = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result     = $conn->query("SHOW COLUMNS FROM `{$safe_table}` LIKE '{$safe_col}'");
    if ($result && $result->num_rows === 0) {
        $conn->query("ALTER TABLE `{$safe_table}` ADD COLUMN {$definition}");
    }
}

function ensure_sms_log_table(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS sms_log (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        recipient_name  VARCHAR(255) NOT NULL,
        recipient_type  VARCHAR(20)  NOT NULL,
        recipient_phone VARCHAR(20)  NOT NULL,
        message         TEXT         NOT NULL,
        status          VARCHAR(10)  NOT NULL,
        batch_number    INT          NULL DEFAULT NULL,
        sent_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )");

    sms_ensure_column($conn, 'sms_log', 'batch_number', 'batch_number INT NULL DEFAULT NULL');
}

function normalize_ghana_phone(string $phone): ?string {
    $phone = preg_replace('/\D/', '', $phone);
    if (strlen($phone) === 10 && str_starts_with($phone, '0')) {
        return '+233' . substr($phone, 1);
    }
    if (strlen($phone) === 9) {
        return '+233' . $phone;
    }
    if (strlen($phone) === 12 && str_starts_with($phone, '233')) {
        return '+' . $phone;
    }
    return null;
}

function get_payloqa_config(): array {
    return [
        'api_key'     => getenv('PAYLOQA_API_KEY')     ?: 'pk_live_of502pjkel',
        'platform_id' => getenv('PAYLOQA_PLATFORM_ID') ?: 'plat_xvadsq3rx0f',
        'sender_id'   => getenv('PAYLOQA_SENDER')      ?: 'ClassIQ',
    ];
}

/**
 * Send SMS to recipients in batches.
 * Returns ['sms_sent' => int, 'errors' => array, 'batches' => array]
 */
function send_sms_in_batches(mysqli $conn, array $recipients, string $message, string $default_type = 'student'): array {
    ensure_sms_log_table($conn);

    $config  = get_payloqa_config();
    $msg_trim = substr(trim($message), 0, 155);

    if (!$msg_trim) {
        return ['sms_sent' => 0, 'errors' => ['Message is required.'], 'batches' => []];
    }

    $prepared = [];
    $errors   = [];

    foreach ($recipients as $r) {
        $phone = normalize_ghana_phone($r['phone'] ?? '');
        if (!$phone) {
            $errors[] = ($r['name'] ?? 'Unknown') . ': invalid phone (' . ($r['phone'] ?? '') . ')';
            continue;
        }
        $prepared[] = [
            'recipient' => $r,
            'phone'     => $phone,
            'type'      => $r['type'] ?? $default_type,
        ];
    }

    if (empty($prepared)) {
        return ['sms_sent' => 0, 'errors' => $errors ?: ['No valid phone numbers found.'], 'batches' => []];
    }

    $chunks  = array_chunk($prepared, SMS_BATCH_SIZE);
    $sms_sent = 0;
    $batches  = [];

    foreach ($chunks as $batch_index => $chunk) {
        $batch_num    = $batch_index + 1;
        $batch_sent   = 0;
        $batch_failed = 0;
        $batch_errors = [];

        $mh      = curl_multi_init();
        $handles = [];

        foreach ($chunk as $item) {
            $payload = json_encode([
                'recipient_number'   => $item['phone'],
                'sender_id'          => $config['sender_id'],
                'message'            => $msg_trim,
                'usage_message_type' => 'notification',
            ]);

            $ch = curl_init('https://sms.payloqa.com/api/v1/sms/send');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $payload,
                CURLOPT_HTTPHEADER     => [
                    'Content-Type: application/json',
                    'X-API-Key: '     . $config['api_key'],
                    'X-Platform-Id: ' . $config['platform_id'],
                ],
                CURLOPT_TIMEOUT => 20,
            ]);

            $handles[] = $item + ['ch' => $ch];
            curl_multi_add_handle($mh, $ch);
        }

        $running = null;
        do {
            curl_multi_exec($mh, $running);
            curl_multi_select($mh);
        } while ($running > 0);

        foreach ($handles as $item) {
            $ch        = $item['ch'];
            $r         = $item['recipient'];
            $phone     = $item['phone'];
            $rtype     = $item['type'];
            $resp      = curl_multi_getcontent($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);

            $resp_data = json_decode($resp, true);
            $ok = $http_code === 200 && ($resp_data['success'] ?? false);

            if ($ok) {
                $sms_sent++;
                $batch_sent++;
            } else {
                $err = $resp_data['message'] ?? $resp_data['error'] ?? null;
                if (is_array($err)) $err = json_encode($err);
                if (!$err) $err = "HTTP $http_code";
                $err_line = "{$r['name']} ({$phone}): $err";
                $errors[] = $err_line;
                $batch_errors[] = $err_line;
                $batch_failed++;
            }

            $rname  = $conn->real_escape_string($r['name']);
            $rtype_e = $conn->real_escape_string($rtype);
            $rmsg   = $conn->real_escape_string($msg_trim);
            $rphone = $conn->real_escape_string($phone);
            $status = $ok ? 'sent' : 'failed';
            $conn->query("INSERT INTO sms_log (recipient_name, recipient_type, recipient_phone, message, status, batch_number, sent_at)
                          VALUES ('$rname', '$rtype_e', '$rphone', '$rmsg', '$status', $batch_num, NOW())");
        }

        curl_multi_close($mh);

        $batches[] = [
            'batch'      => $batch_num,
            'total'      => count($chunk),
            'sent'       => $batch_sent,
            'failed'     => $batch_failed,
            'status'     => $batch_failed === 0 ? 'success' : ($batch_sent > 0 ? 'partial' : 'failed'),
            'errors'     => array_slice($batch_errors, 0, 5),
        ];

        if ($batch_index < count($chunks) - 1) {
            usleep(SMS_BATCH_DELAY_MS * 1000);
        }
    }

    return [
        'sms_sent' => $sms_sent,
        'errors'   => $errors,
        'batches'  => $batches,
        'total'    => count($prepared),
    ];
}
