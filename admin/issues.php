<?php
// api/admin/issues.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $rows = $conn->query("
        SELECT t.id, t.message, t.status, t.created_at,
               u.name AS classrep_name, u.email AS classrep_email,
               SUBSTRING_INDEX(t.message, '\n', 1) AS subject
        FROM troubleshooting_logs t
        LEFT JOIN users u ON u.id = t.user_id
        ORDER BY t.created_at DESC
        LIMIT 200
    ")->fetch_all(MYSQLI_ASSOC);

    // Parse subject from message
    foreach ($rows as &$row) {
        if (str_starts_with($row['message'], 'Subject:')) {
            $lines = explode("\n", $row['message']);
            $row['subject'] = str_replace('Subject: ', '', $lines[0]);
            $row['message'] = trim(implode("\n", array_slice($lines, 2)));
        } else {
            $row['subject'] = substr($row['message'], 0, 60) . (strlen($row['message']) > 60 ? '...' : '');
        }
    }

    json_ok(['issues' => $rows]);
}

if ($method === 'PUT') {
    $body   = get_body();
    $id     = (int)($body['id']     ?? 0);
    $status = $body['status'] ?? 'pending';

    if (!$id) json_error('Issue ID required.');

    $stmt = $conn->prepare("UPDATE troubleshooting_logs SET status = ? WHERE id = ?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();
    json_ok(['message' => 'Issue updated.']);
}

json_error('Method not allowed.', 405);
