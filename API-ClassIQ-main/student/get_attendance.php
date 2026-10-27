<?php
// api/student/get_attendance.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$student_id = (int)($_GET['student_id'] ?? 0);
if (!$student_id) json_error('Student ID required.');

$stmt = $conn->prepare("
    SELECT 
        id,
        lecture_name,
        attendance_date,
        time_marked,
        status
    FROM attendance
    WHERE student_id = ? AND deleted_at IS NULL
    ORDER BY attendance_date DESC, time_marked DESC
    LIMIT 200
");
$stmt->bind_param('i', $student_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

json_ok(['records' => $rows]);