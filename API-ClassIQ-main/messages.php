<?php
// api/messages.php — shared by admin, classrep, and student
require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/messages_helpers.php';
require_once __DIR__ . '/lib/issue_notifications.php';

ensure_messages_table($conn);

$method = $_SERVER['REQUEST_METHOD'];
$token  = get_bearer_token();

// Determine who is calling — admin, classrep, or student
$sender_role = null;
$sender_id   = null;

// Try admin first
$a = $conn->prepare("SELECT id FROM admins WHERE session_token = ? LIMIT 1");
$a->bind_param('s', $token);
$a->execute();
$admin = $a->get_result()->fetch_assoc();
if ($admin) {
    $sender_role = 'admin';
    $sender_id   = (int)$admin['id'];
}

// Try classrep
if (!$sender_role) {
    $c = $conn->prepare("SELECT id FROM users WHERE session_token = ? AND status = 'approved' LIMIT 1");
    $c->bind_param('s', $token);
    $c->execute();
    $classrep = $c->get_result()->fetch_assoc();
    if ($classrep) {
        $sender_role = 'classrep';
        $sender_id   = (int)$classrep['id'];
    }
}

// Try student
if (!$sender_role) {
    $s = $conn->prepare("SELECT id FROM students WHERE session_token = ? LIMIT 1");
    $s->bind_param('s', $token);
    $s->execute();
    $student = $s->get_result()->fetch_assoc();
    if ($student) {
        $sender_role = 'student';
        $sender_id   = (int)$student['id'];
    }
}

if (!$sender_role) json_error('Unauthorized', 401);

// ── GET — fetch thread for an issue ──────────────────────────
if ($method === 'GET' && !isset($_GET['unread_count'])) {
    $issue_id = (int)($_GET['issue_id'] ?? 0);
    if (!$issue_id) json_error('Issue ID required.');

    verify_issue_access($conn, $issue_id, $sender_role, $sender_id);

    $stmt = $conn->prepare("
        SELECT m.id, m.sender_role, m.sender_id, m.message, m.created_at, m.is_read
        FROM messages m
        WHERE m.issue_id = ?
        ORDER BY m.created_at ASC
    ");
    $stmt->bind_param('i', $issue_id);
    $stmt->execute();
    $msgs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    // Mark messages as read for the current viewer
    if ($sender_role === 'admin') {
        $conn->query("
            UPDATE messages SET is_read = 1
            WHERE issue_id = $issue_id AND sender_role IN ('classrep','student') AND is_read = 0
        ");
    } else {
        $conn->query("
            UPDATE messages SET is_read = 1
            WHERE issue_id = $issue_id AND sender_role = 'admin' AND is_read = 0
        ");
    }

    // Fetch issue info
    $issue_stmt = $conn->prepare("
        SELECT t.id, t.message, t.status, t.created_at, t.user_type,
               COALESCE(u.name, s.name) AS reporter_name,
               COALESCE(u.email, s.email) AS reporter_email
        FROM troubleshooting_logs t
        LEFT JOIN users u ON u.id = t.user_id AND (t.user_type IS NULL OR t.user_type = '' OR t.user_type = 'classrep')
        LEFT JOIN students s ON s.id = t.user_id AND t.user_type = 'student'
        WHERE t.id = ?
        LIMIT 1
    ");
    $issue_stmt->bind_param('i', $issue_id);
    $issue_stmt->execute();
    $issue = $issue_stmt->get_result()->fetch_assoc();

    json_ok(['messages' => $msgs, 'issue' => $issue]);
}

// ── POST — send a message ─────────────────────────────────────
if ($method === 'POST') {
    $body     = get_body();
    $issue_id = (int)($body['issue_id'] ?? 0);
    $message  = trim($body['message'] ?? '');

    if (!$issue_id) json_error('Issue ID required.');
    if (!$message)  json_error('Message cannot be empty.');

    verify_issue_access($conn, $issue_id, $sender_role, $sender_id);

    // Verify issue is not closed
    $chk_status = $conn->prepare("SELECT status FROM troubleshooting_logs WHERE id = ? LIMIT 1");
    $chk_status->bind_param('i', $issue_id);
    $chk_status->execute();
    $issue_status = $chk_status->get_result()->fetch_assoc()['status'] ?? '';

    if ($issue_status === 'closed') {
        json_error('Cannot reply to a closed issue.');
    }

    $new_id = insert_thread_message($conn, $issue_id, $sender_role, $sender_id, $message);

    // If issue was resolved, reopen it when classrep/student replies
    if ($sender_role === 'classrep' || $sender_role === 'student') {
        $conn->query("UPDATE troubleshooting_logs SET status = 'pending' WHERE id = $issue_id AND status = 'resolved'");

        // Notify admin of follow-up reply
        $reporter = get_issue_reporter($conn, $issue_id);
        $rname    = $reporter['name'] ?? 'User';
        issue_notify_safe(function () use ($conn, $issue_id, $rname, $sender_role, $message) {
            notify_admin_issue_reply($conn, $issue_id, $rname, $sender_role, $message);
        });
    } elseif ($sender_role === 'admin') {
        // Notify user via SMS + push
        issue_notify_safe(function () use ($conn, $issue_id, $message) {
            notify_user_admin_reply($conn, $issue_id, $message);
        });
    }

    json_ok(['message' => 'Message sent.', 'id' => $new_id]);
}

// ── GET unread count (for sidebar badge) ─────────────────────
if ($method === 'GET' && isset($_GET['unread_count'])) {
    if ($sender_role === 'classrep') {
        $count = $conn->query("
            SELECT COUNT(*) AS c FROM messages m
            JOIN troubleshooting_logs t ON t.id = m.issue_id
            WHERE t.user_id = $sender_id
              AND (t.user_type IS NULL OR t.user_type = '' OR t.user_type = 'classrep')
              AND m.sender_role = 'admin' AND m.is_read = 0
        ")->fetch_assoc()['c'];
    } elseif ($sender_role === 'student') {
        $count = $conn->query("
            SELECT COUNT(*) AS c FROM messages m
            JOIN troubleshooting_logs t ON t.id = m.issue_id
            WHERE t.user_id = $sender_id AND t.user_type = 'student'
              AND m.sender_role = 'admin' AND m.is_read = 0
        ")->fetch_assoc()['c'];
    } else {
        $count = $conn->query("
            SELECT COUNT(*) AS c FROM messages m
            WHERE m.sender_role IN ('classrep','student') AND m.is_read = 0
        ")->fetch_assoc()['c'];
    }

    json_ok(['unread' => (int)$count]);
}

json_error('Method not allowed.', 405);
