<?php
// api/student/mark_attendance.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = get_body();

$classrep_id  = (int)($body['classrep_id']  ?? 0);
$code         = (int)($body['code']          ?? 0);
$lecture_name = trim($body['lecture_name']   ?? '');
$index_number = strtoupper(trim($body['index_number'] ?? ''));
$device_id    = trim($body['device_id']      ?? '');
$student_lat  = isset($body['student_lat']) && $body['student_lat'] !== '' ? (float)$body['student_lat'] : null;
$student_lng  = isset($body['student_lng']) && $body['student_lng'] !== '' ? (float)$body['student_lng'] : null;

// Handle report issue
if (!empty($body['report_issue'])) {
    $issue_index   = strtoupper(trim($body['index_number'] ?? ''));
    $issue_message = trim($body['message'] ?? '');
    if ($issue_index && $issue_message) {
        $full = "Student Index: {$issue_index}\n\n{$issue_message}";
        $stmt = $conn->prepare("INSERT INTO troubleshooting_logs (user_id, message, status, created_at) VALUES (?, ?, 'pending', NOW())");
        $stmt->bind_param('is', $classrep_id, $full);
        $stmt->execute();
    }
    json_ok(['message' => 'Issue reported.']);
}

if (!$classrep_id || !$code || !$index_number || !$device_id) json_error('Missing required fields.');
if ($student_lat === null || $student_lng === null) json_error('Location access is required to mark attendance. Please allow GPS and try again.');

// Verify session
$sess = $conn->prepare("SELECT id, lat, lng, radius_m FROM qr_sessions WHERE classrep_id = ? AND code = ? AND ended_at IS NULL LIMIT 1");
$sess->bind_param('ii', $classrep_id, $code);
$sess->execute();
$session = $sess->get_result()->fetch_assoc();
if (!$session) json_error('Attendance session is closed or invalid.');

$classroom_lat  = $session['lat'];
$classroom_lng  = $session['lng'];
$allowed_radius = $session['radius_m'] ?: 100;

// GPS distance check
if ($classroom_lat !== null && $classroom_lng !== null) {
    $distance = haversine($classroom_lat, $classroom_lng, $student_lat, $student_lng);
    if ($distance > $allowed_radius) {
        json_error("❌ You are outside the classroom radius (" . round($distance) . "m away). You must be physically present to mark attendance.");
    }
}

// Find student
$s = $conn->prepare("SELECT * FROM students WHERE index_number = ? AND user_id = ? LIMIT 1");
$s->bind_param('si', $index_number, $classrep_id);
$s->execute();
$student = $s->get_result()->fetch_assoc();
if (!$student) json_error('Student not found.');

// Duplicate check
$dup = $conn->prepare("SELECT 1 FROM attendance WHERE index_number = ? AND attendance_date = CURDATE() AND classrep_id = ? AND lecture_name = ? LIMIT 1");
$dup->bind_param('sis', $index_number, $classrep_id, $lecture_name);
$dup->execute();
if ($dup->get_result()->num_rows > 0) json_error('You have already marked attendance for this lecture.');

// Device check — flag if same device used by another student
$location_status = 'Present';
$dev = $conn->prepare("SELECT 1 FROM attendance WHERE device_id = ? AND classrep_id = ? AND lecture_name = ? AND attendance_date = CURDATE() AND index_number != ? LIMIT 1");
$dev->bind_param('siss', $device_id, $classrep_id, $lecture_name, $index_number);
$dev->execute();

if ($dev->get_result()->num_rows > 0) {
    $location_status = 'Flagged';
    // Also flag the first student who used this device
    $upd = $conn->prepare("UPDATE attendance SET status = 'Flagged' WHERE device_id = ? AND classrep_id = ? AND lecture_name = ? AND attendance_date = CURDATE() AND index_number != ? AND status = 'Present' AND deleted_at IS NULL");
    $upd->bind_param('siss', $device_id, $classrep_id, $lecture_name, $index_number);
    $upd->execute();
}

$today       = date('Y-m-d');
$time_marked = date('Y-m-d H:i:s');

$ins = $conn->prepare("INSERT INTO attendance (student_id, classrep_id, student_name, index_number, attendance_date, time_marked, lecture_name, device_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
$ins->bind_param('iisssssss', $student['id'], $classrep_id, $student['name'], $index_number, $today, $time_marked, $lecture_name, $device_id, $location_status);

if (!$ins->execute()) json_error('Failed to save attendance: ' . $ins->error);

$message = 'Attendance marked successfully.';
if ($location_status === 'Flagged') $message .= ' (⚠️ flagged for review)';

json_ok(['message' => $message, 'status' => $location_status]);
