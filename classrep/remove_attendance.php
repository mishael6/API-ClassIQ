<?php
// api/classrep/remove_attendance.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_auth($conn);
$classrep_id = $user['id'];
$body        = get_body();

$date         = $body['date']         ?? '';
$lecture_name = $body['lecture_name'] ?? '';
$type         = $body['type']         ?? 'all';   // all | flagged | outside
$index_number = $body['index_number'] ?? null;    // for single-row outside removal

if (!$date || !$lecture_name) json_error('Date and lecture name are required.');

if ($type === 'all') {
    // Permanent delete
    $stmt = $conn->prepare("DELETE FROM attendance WHERE classrep_id = ? AND attendance_date = ? AND lecture_name = ?");
    $stmt->bind_param('iss', $classrep_id, $date, $lecture_name);
    $stmt->execute();
    json_ok(['affected' => $stmt->affected_rows, 'message' => 'All records deleted.']);
}

// Soft-delete flagged or outside
$status = $type === 'flagged' ? 'Flagged' : 'Outside';
$reason = ucfirst($type) . ' — removed by Class Rep';

if ($index_number) {
    // Single row
    $stmt = $conn->prepare("UPDATE attendance SET deleted_at = NOW(), deleted_by = ?, deletion_reason = ? WHERE classrep_id = ? AND attendance_date = ? AND lecture_name = ? AND index_number = ? AND status = ? AND deleted_at IS NULL");
    $stmt->bind_param('isisss s', $classrep_id, $reason, $classrep_id, $date, $lecture_name, $index_number, $status);
} else {
    // All of that type
    $stmt = $conn->prepare("UPDATE attendance SET deleted_at = NOW(), deleted_by = ?, deletion_reason = ? WHERE classrep_id = ? AND attendance_date = ? AND lecture_name = ? AND status = ? AND deleted_at IS NULL");
    $stmt->bind_param('isisss', $classrep_id, $reason, $classrep_id, $date, $lecture_name, $status);
}

$stmt->execute();
json_ok(['affected' => $stmt->affected_rows]);
