<?php
// api/classrep/my_issues.php
require_once __DIR__ . '/../bootstrap.php';
$user        = require_auth($conn);
$classrep_id = $user['id'];

$rows = $conn->query("
    SELECT t.id, t.message, t.status, t.created_at,
           (SELECT COUNT(*) FROM messages m
            WHERE m.issue_id = t.id AND m.sender_role = 'admin' AND m.is_read = 0
           ) AS unread_count
    FROM troubleshooting_logs t
    WHERE t.user_id = $classrep_id
    ORDER BY t.created_at DESC
")->fetch_all(MYSQLI_ASSOC);

foreach ($rows as &$row) {
    if (str_starts_with($row['message'], 'Subject:')) {
        $lines          = explode("\n", $row['message']);
        $row['subject'] = trim(str_replace('Subject: ', '', $lines[0]));
        $row['body']    = trim(implode("\n", array_slice($lines, 2)));
    } else {
        $row['subject'] = strlen($row['message']) > 60
            ? substr($row['message'], 0, 60) . '…'
            : $row['message'];
        $row['body']    = $row['message'];
    }
    $row['unread_count'] = (int)$row['unread_count'];
}

json_ok(['issues' => $rows]);