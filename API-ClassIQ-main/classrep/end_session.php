<?php
// api/classrep/end_session.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_auth($conn);
$classrep_id = $user['id'];
$body        = get_body();
$session_id  = (int)($body['session_id'] ?? 0);

if (!$session_id) json_error('Session ID required.');

$stmt = $conn->prepare("UPDATE qr_sessions SET ended_at = NOW() WHERE id = ? AND classrep_id = ? AND ended_at IS NULL");
$stmt->bind_param('ii', $session_id, $classrep_id);
$stmt->execute();

json_ok(['message' => 'Session ended.']);
