<?php
// api/admin/student_detail.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$id = (int)($_GET['id'] ?? 0);
if (!$id) json_error('Student ID required.');

// Full student info with classrep name
$stmt = $conn->prepare("
    SELECT s.*, u.name AS classrep_name
    FROM students s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
    LIMIT 1
");
$stmt->bind_param('i', $id);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();
if (!$student) json_error('Student not found.');

// Total times marked present
$aStmt = $conn->prepare("
    SELECT COUNT(*) AS c FROM attendance
    WHERE student_id = ? AND deleted_at IS NULL AND status = 'Present'
");
$aStmt->bind_param('i', $id);
$aStmt->execute();
$attendance_count = (int)$aStmt->get_result()->fetch_assoc()['c'];

// Total unique lectures attended
$lStmt = $conn->prepare("
    SELECT COUNT(DISTINCT lecture_name) AS c FROM attendance
    WHERE student_id = ? AND deleted_at IS NULL
");
$lStmt->bind_param('i', $id);
$lStmt->execute();
$lectures_attended = (int)$lStmt->get_result()->fetch_assoc()['c'];

// Recent attendance (last 10)
$rStmt = $conn->prepare("
    SELECT attendance_date, lecture_name, status, time_marked
    FROM attendance
    WHERE student_id = ? AND deleted_at IS NULL
    ORDER BY attendance_date DESC, time_marked DESC
    LIMIT 10
");
$rStmt->bind_param('i', $id);
$rStmt->execute();
$recent_attendance = $rStmt->get_result()->fetch_all(MYSQLI_ASSOC);

json_ok([
    'student'           => $student,
    'attendance_count'  => $attendance_count,
    'lectures_attended' => $lectures_attended,
    'recent_attendance' => $recent_attendance,
]);