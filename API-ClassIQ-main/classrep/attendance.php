<?php
// api/classrep/attendance.php
require_once __DIR__ . '/../bootstrap.php';

$user        = require_auth($conn);
$classrep_id = $user['id'];

$stmt = $conn->prepare("
    SELECT student_id, student_name, index_number, attendance_date,
           time_marked, lecture_name, device_id, status
    FROM attendance
    WHERE classrep_id = ? AND deleted_at IS NULL
    ORDER BY attendance_date DESC, lecture_name ASC, time_marked ASC
    LIMIT 300
");
$stmt->bind_param('i', $classrep_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// Group by date → lecture
$records = [];
foreach ($rows as $row) {
    $records[$row['attendance_date']][$row['lecture_name']][] = $row;
}

json_ok(['records' => $records]);
