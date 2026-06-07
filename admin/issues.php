<?php
// api/admin/issues.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list issues ─────────────────────────────────────────
if ($method === 'GET') {
    $status = $conn->real_escape_string($_GET['status'] ?? '');
    $where  = $status ? "WHERE t.status = '$status'" : '';

    $rows = $conn->query("
        SELECT t.id, t.message, t.status, t.created_at,
               COALESCE(t.user_type, 'classrep') AS user_type,
               COALESCE(u.name, s.name)  AS classrep_name,
               COALESCE(u.email, s.email) AS classrep_email,
               COALESCE(u.id, s.id)      AS classrep_id,
               (SELECT COUNT(*) FROM messages m WHERE m.issue_id = t.id AND m.is_read = 0 AND m.sender_role IN ('classrep','student')) AS unread_count
        FROM troubleshooting_logs t
        LEFT JOIN users u ON u.id = t.user_id AND (t.user_type IS NULL OR t.user_type = 'classrep')
        LEFT JOIN students s ON s.id = t.user_id AND t.user_type = 'student'
        $where
        ORDER BY t.created_at DESC
        LIMIT 200
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
}

// ── PUT — resolve/reopen ──────────────────────────────────────
if ($method === 'PUT') {
    $body   = get_body();
    $id     = (int)($body['id']     ?? 0);
    $status = $body['status'] ?? 'pending';
    if (!$id) json_error('Issue ID required.');

    $safe_status = $conn->real_escape_string($status);
    $conn->query("UPDATE troubleshooting_logs SET status = '$safe_status' WHERE id = $id");
    json_ok(['message' => 'Issue updated.']);
}

json_error('Method not allowed.', 405);
