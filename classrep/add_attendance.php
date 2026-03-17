<?php
// api/classrep/add_attendance.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_auth($conn);
$classrep_id = $user['id'];
$body        = get_body();

$index_number    = strtoupper(trim($body['index_number']    ?? ''));
$attendance_date = $body['attendance_date'] ?? date('Y-m-d');
$lecture_name    = $body['lecture_name']    ?? '';

if (!$index_number || !$lecture_name) json_error('Index number and lecture name required.');

// Find student
$stmt = $conn->prepare("SELECT id, name, index_number FROM students WHERE index_number = ? AND user_id = ? LIMIT 1");
$stmt->bind_param('si', $index_number, $classrep_id);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();
if (!$student) json_error('Student not found.');

// Check existing
$chk = $conn->prepare("SELECT id, deleted_at FROM attendance WHERE student_id = ? AND attendance_date = ? AND lecture_name = ? AND classrep_id = ?");
$chk->bind_param('issi', $student['id'], $attendance_date, $lecture_name, $classrep_id);
$chk->execute();
$existing = $chk->get_result()->fetch_assoc();

if ($existing) {
    if ($existing['deleted_at']) {
        $restore = $conn->prepare("UPDATE attendance SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL WHERE id = ?");
        $restore->bind_param('i', $existing['id']);
        $restore->execute();
        json_ok(['message' => 'Deleted attendance record restored.']);
    }
    json_error('Student already marked for this lecture.');
}

$time_marked = date('H:i:s');
$device_id   = 'Manual Add by Class Rep';

$ins = $conn->prepare("INSERT INTO attendance (student_id, classrep_id, student_name, index_number, attendance_date, time_marked, lecture_name, device_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Present', NOW())");
$ins->bind_param('iisssssss', $student['id'], $classrep_id, $student['name'], $index_number, $attendance_date, $time_marked, $lecture_name, $device_id);

if (!$ins->execute()) json_error('Failed to add attendance.');
json_ok(['message' => 'Student added to attendance.']);
