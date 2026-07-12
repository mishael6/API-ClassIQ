<?php
// api/lib/ai_helpers.php — Six AI settings and usage helpers

function ensure_ai_settings_schema(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS ai_settings (
        setting_key VARCHAR(64) PRIMARY KEY,
        setting_value VARCHAR(255) NOT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $defaults = [
        'subscription_price' => '30.00',
        'free_prompt_limit'  => '30',
    ];
    foreach ($defaults as $key => $value) {
        $stmt = $conn->prepare("INSERT IGNORE INTO ai_settings (setting_key, setting_value) VALUES (?, ?)");
        $stmt->bind_param('ss', $key, $value);
        $stmt->execute();
    }
}

function ai_get_setting(mysqli $conn, string $key, string $default = ''): string {
    ensure_ai_settings_schema($conn);
    $stmt = $conn->prepare("SELECT setting_value FROM ai_settings WHERE setting_key = ? LIMIT 1");
    $stmt->bind_param('s', $key);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row['setting_value'] ?? $default;
}

function ai_set_setting(mysqli $conn, string $key, string $value): void {
    ensure_ai_settings_schema($conn);
    $stmt = $conn->prepare("INSERT INTO ai_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?");
    $stmt->bind_param('sss', $key, $value, $value);
    $stmt->execute();
}

/** Free-tier prompt cap per 2-hour window (admin-configurable, default 30). */
function ai_free_prompt_limit(mysqli $conn): int {
    $limit = (int)ai_get_setting($conn, 'free_prompt_limit', '30');
    if ($limit < 1) $limit = 1;
    if ($limit > 999) $limit = 999;
    return $limit;
}

function ai_usage_limit_message(int $limit, string $window_start): string {
    $diff = strtotime($window_start) + 7200 - time();
    $mins = max(1, (int)ceil($diff / 60));
    return "You've used all {$limit} prompts for this 2-hour window. Resets in {$mins} minute(s). Upgrade Six for unlimited access!";
}
