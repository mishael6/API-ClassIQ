<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);

$stmt = $conn->prepare("
    SELECT student_id, student_name, index_number, attendance_date,
           time_marked, lecture_name, week_number, device_id, status
    FROM attendance
    WHERE lecturer_id = ? AND deleted_at IS NULL
    ORDER BY week_number ASC, attendance_date DESC, time_marked ASC
    LIMIT 500
");
$stmt->bind_param('i', $lecturer_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$records = [];
foreach ($rows as $row) {
    $week_key = 'Week ' . ($row['week_number'] ?? 0) . ': ' . ($row['lecture_name'] ?? '');
    $records[$week_key][$row['attendance_date']][] = $row;
}

json_ok(['records' => $records]);
