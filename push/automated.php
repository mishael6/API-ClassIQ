<?php
// api/push/automated.php — automatic push triggers
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/templates.php';

function ensure_push_automation_tables(mysqli $conn): void {
    ensure_push_tables($conn);
    $conn->query("CREATE TABLE IF NOT EXISTS push_daily_sent (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        sent_date    DATE         NOT NULL,
        message_type VARCHAR(20)  NOT NULL,
        title        VARCHAR(255) NOT NULL,
        body         TEXT         NOT NULL,
        sent_count   INT          NOT NULL DEFAULT 0,
        sent_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_date_type (sent_date, message_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function daily_push_already_sent(mysqli $conn, string $type): bool {
    ensure_push_automation_tables($conn);
    $today = date('Y-m-d');
    $stmt  = $conn->prepare("SELECT 1 FROM push_daily_sent WHERE sent_date = ? AND message_type = ? LIMIT 1");
    $stmt->bind_param('ss', $today, $type);
    $stmt->execute();
    return $stmt->get_result()->num_rows > 0;
}

function log_daily_push(mysqli $conn, string $type, string $title, string $body, int $sent): void {
    $today = date('Y-m-d');
    $stmt  = $conn->prepare("INSERT INTO push_daily_sent (sent_date, message_type, title, body, sent_count)
                             VALUES (?, ?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE sent_count = VALUES(sent_count), sent_at = NOW()");
    $stmt->bind_param('ssssi', $today, $type, $title, $body, $sent);
    $stmt->execute();
}

function send_attendance_push(mysqli $conn, array $student, string $lecture, string $status): void {
    ensure_push_automation_tables($conn);
    $student_id = (int)($student['id'] ?? 0);
    if (!$student_id) return;

    $msg = push_attendance_success_message($lecture, $status);
    notify_student_push($conn, $student_id, $msg['title'], $msg['body'], 'attendance');
}

/** Morning motivation — broadcast to all subscribed students */
function send_morning_motivation(mysqli $conn): array {
    ensure_push_automation_tables($conn);

    if (daily_push_already_sent($conn, 'motivation')) {
        return ['skipped' => true, 'reason' => 'Already sent today.'];
    }

    $body  = pick_daily_message('motivation');
    $title = 'Good morning from ClassIQ ☀️';
    $result = broadcast_push($conn, $title, $body, 'student', null, 'motivation');

    log_daily_push($conn, 'motivation', $title, $body, $result['sent']);
    return array_merge($result, ['type' => 'motivation', 'title' => $title, 'body' => $body]);
}

/** Feature tip — broadcast every few days */
function send_feature_tip(mysqli $conn): array {
    ensure_push_automation_tables($conn);

    // Feature tips on Mon, Wed, Fri
    $dow = (int)date('N');
    if (!in_array($dow, [1, 3, 5])) {
        return ['skipped' => true, 'reason' => 'Feature tips sent Mon/Wed/Fri only.'];
    }

    if (daily_push_already_sent($conn, 'feature')) {
        return ['skipped' => true, 'reason' => 'Feature tip already sent today.'];
    }

    $body  = pick_daily_message('feature');
    $title = 'ClassIQ Tip 💡';
    $result = broadcast_push($conn, $title, $body, 'student', null, 'feature');

    log_daily_push($conn, 'feature', $title, $body, $result['sent']);
    return array_merge($result, ['type' => 'feature', 'title' => $title, 'body' => $body]);
}

/** Run all daily automated pushes (called by cron) */
function run_daily_push_jobs(mysqli $conn): array {
    $results = [];
    $hour    = (int)date('G');

    // Motivation between 6am–10am Ghana time (bootstrap sets Africa/Accra)
    if ($hour >= 6 && $hour <= 10) {
        $results['motivation'] = send_morning_motivation($conn);
    } else {
        $results['motivation'] = ['skipped' => true, 'reason' => 'Outside morning window (6am–10am).'];
    }

    $results['feature'] = send_feature_tip($conn);
    return $results;
}
