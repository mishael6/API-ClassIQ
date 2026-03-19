<?php
// api/classrep/student_detail.php
require_once __DIR__ . '/../bootstrap.php';
$user        = require_auth($conn);
$classrep_id = $user['id'];
$student_id  = (int)($_GET['id'] ?? 0);

if (!$student_id) json_error('Student ID required.');

// Verify student belongs to this classrep
$stmt = $conn->prepare("SELECT * FROM students WHERE id = ? AND user_id = ? LIMIT 1");
$stmt->bind_param('ii', $student_id, $classrep_id);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();
if (!$student) json_error('Student not found.');

// Attendance summary
$summary = $conn->query("
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'Flagged' THEN 1 ELSE 0 END) AS flagged,
        COUNT(DISTINCT lecture_name) AS lectures,
        MAX(attendance_date) AS last_seen
    FROM attendance
    WHERE student_id = $student_id AND deleted_at IS NULL
")->fetch_assoc();

// Recent attendance history (last 15)
$history = $conn->query("
    SELECT attendance_date, lecture_name, status, time_marked
    FROM attendance
    WHERE student_id = $student_id AND deleted_at IS NULL
    ORDER BY attendance_date DESC, time_marked DESC
    LIMIT 15
")->fetch_all(MYSQLI_ASSOC);

json_ok([
    'student' => $student,
    'summary' => $summary,
    'history' => $history,
]);