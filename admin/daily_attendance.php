<?php
// api/admin/daily_attendance.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$date = $conn->real_escape_string($_GET['date'] ?? date('Y-m-d'));

$rows = $conn->query("
    SELECT a.student_name, a.index_number, a.lecture_name,
           a.time_marked, a.status, a.device_id,
           u.name AS classrep_name
    FROM attendance a
    LEFT JOIN users u ON u.id = a.classrep_id
    WHERE a.attendance_date = '$date' AND a.deleted_at IS NULL
    ORDER BY a.time_marked ASC
")->fetch_all(MYSQLI_ASSOC);

json_ok(['records' => $rows, 'date' => $date, 'total' => count($rows)]);
