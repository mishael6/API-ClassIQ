<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);

$stmt = $conn->prepare("
    SELECT student_id, student_name, index_number, attendance_date,
           time_marked, lecture_name, week_number, class_number, class_id, semester_id, device_id, status
    FROM attendance
    WHERE lecturer_id = ? AND deleted_at IS NULL
    ORDER BY attendance_date DESC, week_number ASC, class_number ASC, time_marked ASC
    LIMIT 500
");
$stmt->bind_param('i', $lecturer_id);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

$semester_names = [];
$sn = $conn->prepare("SELECT id, name FROM lecturer_semesters WHERE lecturer_id = ?");
$sn->bind_param('i', $lecturer_id);
$sn->execute();
foreach ($sn->get_result()->fetch_all(MYSQLI_ASSOC) as $s) {
    $semester_names[(int)$s['id']] = $s['name'];
}

$records = [];
foreach ($rows as $row) {
    $sem_label = isset($semester_names[(int)($row['semester_id'] ?? 0)]) ? $semester_names[$row['semester_id']] : 'Semester';
    $week_key  = "{$sem_label} · Week " . ($row['week_number'] ?? 0) . " · Class " . ($row['class_number'] ?? 1) . ": " . ($row['lecture_name'] ?? '');
    $records[$week_key][$row['attendance_date']][] = $row;
}

json_ok(['records' => $records]);
