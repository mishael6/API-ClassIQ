<?php
// api/student/get_my_issues.php
require_once __DIR__ . '/../bootstrap.php';
$user = require_auth($conn);
$student_id = $user['id'];

// Get issues reported by this student
$issues = $conn->query("
    SELECT t.id, t.message, t.status, t.created_at,
           (SELECT COUNT(*) FROM messages m WHERE m.issue_id = t.id AND m.is_read = 0 AND m.sender_role = 'admin') AS unread_admin_replies
    FROM troubleshooting_logs t
    WHERE t.user_id = $student_id AND t.user_type = 'student'
    ORDER BY t.created_at DESC
")->fetch_all(MYSQLI_ASSOC);

// Get replies for these issues
foreach ($issues as &$issue) {
    $issue_id = $issue['id'];
    $issue['replies'] = $conn->query("
        SELECT message, sender_role, created_at
        FROM messages
        WHERE issue_id = $issue_id
        ORDER BY created_at ASC
    ")->fetch_all(MYSQLI_ASSOC);
}

json_ok(['issues' => $issues]);
