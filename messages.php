<?php
// api/messages.php — shared by admin and classrep
require_once __DIR__ . '/bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$token  = get_bearer_token();

// Determine who is calling — admin or classrep
$sender_role = null;
$sender_id   = null;

// Try admin first
$a = $conn->prepare("SELECT id FROM admins WHERE session_token = ? LIMIT 1");
$a->bind_param('s', $token);
$a->execute();
$admin = $a->get_result()->fetch_assoc();
if ($admin) {
    $sender_role = 'admin';
    $sender_id   = $admin['id'];
}

// Try classrep
if (!$sender_role) {
    $c = $conn->prepare("SELECT id FROM users WHERE session_token = ? AND status = 'approved' LIMIT 1");
    $c->bind_param('s', $token);
    $c->execute();
    $classrep = $c->get_result()->fetch_assoc();
    if ($classrep) {
        $sender_role = 'classrep';
        $sender_id   = $classrep['id'];
    }
}

if (!$sender_role) json_error('Unauthorized', 401);

// ── GET — fetch thread for an issue ──────────────────────────
if ($method === 'GET') {
    $issue_id = (int)($_GET['issue_id'] ?? 0);
    if (!$issue_id) json_error('Issue ID required.');

    // Verify access — classrep can only see their own issues
    if ($sender_role === 'classrep') {
        $chk = $conn->prepare("SELECT id FROM troubleshooting_logs WHERE id = ? AND user_id = ? LIMIT 1");
        $chk->bind_param('ii', $issue_id, $sender_id);
        $chk->execute();
        if ($chk->get_result()->num_rows === 0) json_error('Access denied.', 403);
    }

    // Fetch all messages in thread
    $msgs = $conn->query("
        SELECT m.id, m.sender_role, m.sender_id, m.message, m.created_at, m.is_read
        FROM messages m
        WHERE m.issue_id = $issue_id
        ORDER BY m.created_at ASC
    ")->fetch_all(MYSQLI_ASSOC);

    // Mark messages as read for the current viewer
    $opposite_role = $sender_role === 'admin' ? 'classrep' : 'admin';
    $conn->query("
        UPDATE messages SET is_read = 1
        WHERE issue_id = $issue_id AND sender_role = '$opposite_role' AND is_read = 0
    ");

    // Fetch issue info
    $issue_stmt = $conn->prepare("
        SELECT t.id, t.message, t.status, t.created_at,
               u.name AS classrep_name, u.email AS classrep_email
        FROM troubleshooting_logs t
        LEFT JOIN users u ON u.id = t.user_id
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

    // Verify classrep can only post to their own issues
    if ($sender_role === 'classrep') {
        $chk = $conn->prepare("SELECT id FROM troubleshooting_logs WHERE id = ? AND user_id = ? LIMIT 1");
        $chk->bind_param('ii', $issue_id, $sender_id);
        $chk->execute();
        if ($chk->get_result()->num_rows === 0) json_error('Access denied.', 403);
    }

    $safe_message = $conn->real_escape_string($message);
    $conn->query("
        INSERT INTO messages (issue_id, sender_role, sender_id, message, created_at)
        VALUES ($issue_id, '$sender_role', $sender_id, '$safe_message', NOW())
    ");

    // If issue was resolved, reopen it when classrep replies
    if ($sender_role === 'classrep') {
        $conn->query("UPDATE troubleshooting_logs SET status = 'pending' WHERE id = $issue_id AND status = 'resolved'");
    }

    json_ok(['message' => 'Message sent.', 'id' => $conn->insert_id]);
}

// ── GET unread count (for sidebar badge) ─────────────────────
if ($method === 'GET' && isset($_GET['unread_count'])) {
    $opposite = $sender_role === 'admin' ? 'classrep' : 'admin';

    if ($sender_role === 'classrep') {
        $count = $conn->query("
            SELECT COUNT(*) AS c FROM messages m
            JOIN troubleshooting_logs t ON t.id = m.issue_id
            WHERE t.user_id = $sender_id AND m.sender_role = 'admin' AND m.is_read = 0
        ")->fetch_assoc()['c'];
    } else {
        $count = $conn->query("
            SELECT COUNT(*) AS c FROM messages m
            WHERE m.sender_role = 'classrep' AND m.is_read = 0
        ")->fetch_assoc()['c'];
    }

    json_ok(['unread' => (int)$count]);
}

json_error('Method not allowed.', 405);