<?php
require_once __DIR__ . '/../bootstrap.php';

$user        = require_auth($conn);
$classrep_id = $user['id'];
$today       = date('Y-m-d');

// Total students
$total_students = (int)$conn->query("SELECT COUNT(*) AS c FROM students WHERE user_id = $classrep_id")->fetch_assoc()['c'];

// Attendance today
$attendance_today = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE classrep_id = $classrep_id AND attendance_date = '$today' AND deleted_at IS NULL")->fetch_assoc()['c'];

// Last session
$last_row     = $conn->query("SELECT MAX(time_marked) AS last FROM attendance WHERE classrep_id = $classrep_id AND deleted_at IS NULL")->fetch_assoc();
$last_session = $last_row['last'] ? date('M j, g:i A', strtotime($last_row['last'])) : 'No sessions yet';

// Pending issues
$pending_issues = (int)$conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE user_id = $classrep_id AND status = 'pending'")->fetch_assoc()['c'];

// Chart — last 7 days
$chart = [];
for ($i = 6; $i >= 0; $i--) {
    $d   = date('Y-m-d', strtotime("-$i days"));
    $day = date('D', strtotime($d));
    $rc  = $conn->query("SELECT COUNT(*) AS c FROM attendance WHERE classrep_id = $classrep_id AND attendance_date = '$d' AND deleted_at IS NULL");
    $chart[] = ['day' => $day, 'count' => (int)$rc->fetch_assoc()['c']];
}

// Students with attendance count
$students = $conn->query("
    SELECT s.id, s.name, s.index_number, s.email, s.phone,
           s.institution, s.department, s.program, s.level, s.created_at,
           COUNT(a.id) AS attendance_count,
           SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
           SUM(CASE WHEN a.status = 'Flagged' THEN 1 ELSE 0 END) AS flagged_count,
           MAX(a.attendance_date) AS last_seen
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.deleted_at IS NULL
    WHERE s.user_id = $classrep_id
    GROUP BY s.id
    ORDER BY s.name ASC
")->fetch_all(MYSQLI_ASSOC);

json_ok([
    'stats' => [
        'total_students'   => $total_students,
        'attendance_today' => $attendance_today,
        'last_session'     => $last_session,
        'pending_issues'   => $pending_issues,
    ],
    'chart'    => $chart,
    'students' => $students,
]);
