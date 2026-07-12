<?php
// api/lib/issue_notifications.php — SMS + push for issue reports and replies

require_once __DIR__ . '/sms_helpers.php';
require_once __DIR__ . '/../push/helpers.php';

function issue_text_preview(string $text, int $max = 80): string {
    $text = preg_replace('/\s+/', ' ', trim($text));
    if ($text === '') return '';
    if (strlen($text) <= $max) return $text;
    return substr($text, 0, $max - 1) . '…';
}

function issue_parse_subject(string $message): string {
    if (str_starts_with($message, 'Subject:')) {
        $lines = explode("\n", $message);
        return trim(str_replace('Subject: ', '', $lines[0]));
    }
    return issue_text_preview($message, 60) ?: 'Support issue';
}

function get_admin_notify_recipients(): array {
    $raw = getenv('ADMIN_PHONE') ?: '';
    $recipients = [];

    foreach (preg_split('/[,;]+/', $raw) as $phone) {
        $phone = trim($phone);
        if ($phone !== '') {
            $recipients[] = [
                'name'  => 'ClassIQ Admin',
                'phone' => $phone,
                'type'  => 'admin',
            ];
        }
    }

    return $recipients;
}

function get_issue_reporter(mysqli $conn, int $issue_id): ?array {
    $stmt = $conn->prepare("
        SELECT t.id, t.user_id, t.message,
               COALESCE(NULLIF(t.user_type, ''), 'classrep') AS user_type,
               COALESCE(u.name, s.name)  AS name,
               COALESCE(u.phone, s.phone) AS phone
        FROM troubleshooting_logs t
        LEFT JOIN users u ON u.id = t.user_id
            AND (t.user_type IS NULL OR t.user_type = '' OR t.user_type = 'classrep')
        LEFT JOIN students s ON s.id = t.user_id AND t.user_type = 'student'
        WHERE t.id = ?
        LIMIT 1
    ");
    $stmt->bind_param('i', $issue_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) return null;

    return [
        'issue_id'  => (int)$row['id'],
        'user_id'   => (int)$row['user_id'],
        'user_type' => $row['user_type'] === 'student' ? 'student' : 'classrep',
        'name'      => $row['name'] ?: 'User',
        'phone'     => trim($row['phone'] ?? ''),
        'subject'   => issue_parse_subject($row['message'] ?? ''),
    ];
}

/** Fire-and-forget wrapper so notifications never break the main request */
function issue_notify_safe(callable $fn): void {
    try {
        $fn();
    } catch (Throwable $e) {
        error_log('Issue notification error: ' . $e->getMessage());
    }
}

/** Admin SMS when a new issue is reported */
function notify_admin_new_issue(
    mysqli $conn,
    int $issue_id,
    string $reporter_name,
    string $user_type,
    string $subject,
    string $body
): void {
    $recipients = get_admin_notify_recipients();
    if (empty($recipients)) return;

    $label = $user_type === 'student' ? 'Student' : 'Class Rep';
    $sms   = "ClassIQ: New issue from $label $reporter_name.\n"
           . "Subject: $subject\n"
           . issue_text_preview($body, 90)
           . "\nOpen admin dashboard to reply.";

    send_sms_in_batches($conn, $recipients, $sms, 'admin');
}

/** Admin SMS when a user sends a follow-up in an existing thread */
function notify_admin_issue_reply(
    mysqli $conn,
    int $issue_id,
    string $reporter_name,
    string $user_type,
    string $reply
): void {
    $recipients = get_admin_notify_recipients();
    if (empty($recipients)) return;

    $reporter = get_issue_reporter($conn, $issue_id);
    $subject  = $reporter['subject'] ?? 'Support issue';
    $label    = $user_type === 'student' ? 'Student' : 'Class Rep';

    $sms = "ClassIQ: $label $reporter_name replied on \"$subject\".\n"
         . issue_text_preview($reply, 100)
         . "\nOpen admin dashboard to view.";

    send_sms_in_batches($conn, $recipients, $sms, 'admin');
}

/** User SMS + push when admin replies */
function notify_user_admin_reply(mysqli $conn, int $issue_id, string $reply): void {
    $reporter = get_issue_reporter($conn, $issue_id);
    if (!$reporter) return;

    $subject = $reporter['subject'];
    $title   = 'Admin replied to your issue';
    $push_body = 'Re: ' . $subject . ' — ' . issue_text_preview($reply, 100);
    $sms_body  = 'ClassIQ: Admin replied to "' . $subject . '". '
               . issue_text_preview($reply, 90)
               . ' Open ClassIQ to read the full message.';

    if ($reporter['phone'] !== '') {
        send_sms_in_batches($conn, [[
            'name'  => $reporter['name'],
            'phone' => $reporter['phone'],
            'type'  => $reporter['user_type'],
        ]], $sms_body, $reporter['user_type']);
    }

    if ($reporter['user_type'] === 'student') {
        notify_student_push($conn, $reporter['user_id'], $title, $push_body, 'issue');
    } else {
        broadcast_push($conn, $title, $push_body, 'classrep', $reporter['user_id'], 'issue');
    }
}
