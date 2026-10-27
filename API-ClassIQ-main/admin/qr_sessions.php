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
$offset = (int)($_GET['offset'] ?? 0);

// Get real total count for accurate frontend pagination
$total = (int)$conn->query("SELECT COUNT(*) AS c FROM qr_sessions")->fetch_assoc()['c'];

$rows = $conn->query("
    SELECT q.*, u.name AS classrep_name
    FROM qr_sessions q
    LEFT JOIN users u ON u.id = q.classrep_id
    ORDER BY q.created_at DESC
    LIMIT $limit OFFSET $offset
")->fetch_all(MYSQLI_ASSOC);

json_ok(['sessions' => $rows, 'total' => $total]);
