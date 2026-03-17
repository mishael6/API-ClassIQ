<?php
// api/admin/qr_sessions.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$limit  = min((int)($_GET['limit'] ?? 100), 500);
$offset = (int)($_GET['offset'] ?? 0);

$rows = $conn->query("
    SELECT q.*, u.name AS classrep_name
    FROM qr_sessions q
    LEFT JOIN users u ON u.id = q.classrep_id
    ORDER BY q.created_at DESC
    LIMIT $limit OFFSET $offset
")->fetch_all(MYSQLI_ASSOC);

json_ok(['sessions' => $rows, 'total' => count($rows)]);
