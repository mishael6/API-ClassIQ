<?php
// api/admin/qr_sessions.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// Handle ending active sessions
if ($method === 'POST') {
    $body = get_body();
    if (($body['action'] ?? '') === 'end') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) json_error('Session ID required.');
        $conn->query("UPDATE qr_sessions SET ended_at = NOW() WHERE id = $id");
        json_ok(['message' => 'Session ended successfully.']);
    }
    json_error('Invalid action.', 400);
}

// Ensure GET method for fetching
if ($method !== 'GET') {
    json_error('Method not allowed.', 405);
}

$limit  = min((int)($_GET['limit'] ?? 100), 500);
$offset = max(0, (int)($_GET['offset'] ?? 0));
$where  = '1=1';
$classrep_id = (int)($_GET['classrep_id'] ?? 0);
$date = trim($_GET['date'] ?? '');

if ($classrep_id > 0) $where .= " AND q.classrep_id = $classrep_id";
if ($date !== '') {
    if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $date)) json_error('Invalid date.', 400);
    $safe_date = $conn->real_escape_string($date);
    $where .= " AND DATE(q.created_at) = '$safe_date'";
}

// Get real total count for accurate frontend pagination
$total = (int)$conn->query("SELECT COUNT(*) AS c FROM qr_sessions q WHERE $where")->fetch_assoc()['c'];

$rows = $conn->query("
    SELECT q.*, u.name AS classrep_name
    FROM qr_sessions q
    LEFT JOIN users u ON u.id = q.classrep_id
    WHERE $where
    ORDER BY q.created_at DESC
    LIMIT $limit OFFSET $offset
")->fetch_all(MYSQLI_ASSOC);

json_ok(['sessions' => $rows, 'total' => $total]);
