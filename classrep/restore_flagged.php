<?php
// api/classrep/restore_flagged.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_auth($conn);
$classrep_id = $user['id'];
$body        = get_body();

$date         = $body['date']         ?? '';
$lecture_name = $body['lecture_name'] ?? '';
$action       = $body['action']       ?? 'restore_flagged';

if (!$date || !$lecture_name) json_error('Date and lecture name required.');

$stmt = $conn->prepare("UPDATE attendance SET status = 'Present' WHERE classrep_id = ? AND attendance_date = ? AND lecture_name = ? AND status = 'Flagged' AND deleted_at IS NULL");
$stmt->bind_param('iss', $classrep_id, $date, $lecture_name);
$stmt->execute();

json_ok(['affected' => $stmt->affected_rows]);
