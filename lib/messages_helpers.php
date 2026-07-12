<?php
// api/lib/messages_helpers.php — shared issue chat schema + access checks

function ensure_messages_table(mysqli $conn): void {
    $conn->query("CREATE TABLE IF NOT EXISTS messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        issue_id    INT          NOT NULL,
        sender_role VARCHAR(20)  NOT NULL DEFAULT 'classrep',
        sender_id   INT          NULL DEFAULT NULL,
        message     TEXT         NOT NULL,
        is_read     TINYINT(1)   NOT NULL DEFAULT 0,
        created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_issue (issue_id),
        INDEX idx_issue_unread (issue_id, is_read, sender_role)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $cols = [];
    $res  = $conn->query("SHOW COLUMNS FROM messages");
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $cols[$row['Field']] = true;
        }
    }

    if (empty($cols['sender_id'])) {
        $conn->query("ALTER TABLE messages ADD COLUMN sender_id INT NULL DEFAULT NULL AFTER sender_role");
    }
    if (empty($cols['is_read'])) {
        $conn->query("ALTER TABLE messages ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER message");
    }

    // Widen ENUM / VARCHAR so student replies are accepted on older databases
    @$conn->query("ALTER TABLE messages MODIFY COLUMN sender_role VARCHAR(20) NOT NULL DEFAULT 'classrep'");
}

function verify_issue_access(mysqli $conn, int $issue_id, string $sender_role, int $sender_id): void {
    if ($sender_role === 'admin') {
        return;
    }

    if ($sender_role === 'student') {
        $stmt = $conn->prepare("
            SELECT id FROM troubleshooting_logs
            WHERE id = ? AND user_id = ? AND user_type = 'student'
            LIMIT 1
        ");
    } else {
        $stmt = $conn->prepare("
            SELECT id FROM troubleshooting_logs
            WHERE id = ? AND user_id = ?
              AND (user_type IS NULL OR user_type = '' OR user_type = 'classrep')
            LIMIT 1
        ");
    }

    $stmt->bind_param('ii', $issue_id, $sender_id);
    $stmt->execute();
    if ($stmt->get_result()->num_rows === 0) {
        json_error('Access denied.', 403);
    }
}

function insert_thread_message(mysqli $conn, int $issue_id, string $sender_role, int $sender_id, string $message): int {
    $stmt = $conn->prepare("
        INSERT INTO messages (issue_id, sender_role, sender_id, message, is_read, created_at)
        VALUES (?, ?, ?, ?, 0, NOW())
    ");
    $stmt->bind_param('isis', $issue_id, $sender_role, $sender_id, $message);
    if (!$stmt->execute()) {
        json_error('Failed to send message: ' . $stmt->error, 500);
    }
    return (int)$conn->insert_id;
}
