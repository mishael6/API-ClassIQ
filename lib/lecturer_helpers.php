<?php
// api/lib/lecturer_helpers.php — schema + shared lecturer utilities

function lecturer_ensure_column(mysqli $conn, string $table, string $column, string $definition): void {
    $safe_table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safe_col   = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result     = $conn->query("SHOW COLUMNS FROM `{$safe_table}` LIKE '{$safe_col}'");
    if ($result && $result->num_rows === 0) {
        $conn->query("ALTER TABLE `{$safe_table}` ADD COLUMN {$definition}");
    }
}

function ensure_lecturer_schema(mysqli $conn): void {
    lecturer_ensure_column($conn, 'users', 'course', 'course VARCHAR(255) NULL DEFAULT NULL');

    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_weeks (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        lecturer_id  INT          NOT NULL,
        week_number  INT          NOT NULL,
        topic        VARCHAR(255) NOT NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_lecturer_week (lecturer_id, week_number),
        INDEX idx_lecturer (lecturer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    lecturer_ensure_column($conn, 'qr_sessions', 'lecturer_id', 'lecturer_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'week_number', 'week_number INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'lecturer_id', 'lecturer_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'week_number', 'week_number INT NULL DEFAULT NULL');

    // Allow lecturer-only QR sessions without a classrep
    @$conn->query("ALTER TABLE qr_sessions MODIFY COLUMN classrep_id INT NULL DEFAULT NULL");
    @$conn->query("ALTER TABLE attendance MODIFY COLUMN classrep_id INT NULL DEFAULT NULL");
}

function send_classiq_mail(string $to, string $subject, string $body): void {
    $from = getenv('CLASSIQ_MAIL_FROM') ?: 'classiq660@gmail.com';
    $headers = "From: ClassIQ <{$from}>\r\nReply-To: {$from}\r\nContent-Type: text/plain; charset=UTF-8";
    @mail($to, $subject, $body, $headers);
}

function normalize_user_role(array $user): array {
    $role = $user['role'] ?? '';
    if ($role === 'class_rep') $user['role'] = 'classrep';
    return $user;
}
