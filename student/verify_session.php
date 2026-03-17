<?php
// api/student/verify_session.php
require_once __DIR__ . '/../bootstrap.php';

$classrep_id = (int)($_GET['classrep_id'] ?? 0);
$code        = (int)($_GET['code']        ?? 0);

if (!$classrep_id || !$code) json_ok(['valid' => false]);

$stmt = $conn->prepare("SELECT id FROM qr_sessions WHERE classrep_id = ? AND code = ? AND ended_at IS NULL LIMIT 1");
$stmt->bind_param('ii', $classrep_id, $code);
$stmt->execute();

json_ok(['valid' => $stmt->get_result()->num_rows > 0]);
