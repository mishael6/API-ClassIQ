<?php
require_once __DIR__ . '/../bootstrap.php';

$user        = require_auth($conn);
$classrep_id = $user['id'];
$today       = date('Y-m-d');

// Total students
$r = $conn->query("SELECT COUNT(*) AS c FROM students WHERE user_id = $classrep_id");
$total_students = $r->fetch_assoc()['c'];

// Attendance today
$r2 = $conn->query("SELECT COUNT(*) AS c FROM attendance WHERE classrep_id = $classrep_id AND attendance_date = '$today' AND deleted_at IS NULL");
$attendance_today = $r2->fetch_assoc()['c'];

// Last session
$r3 = $conn->query("SELECT MAX(time_marked) AS last FROM attendance WHERE classrep_id = $classrep_id AND deleted_at IS NULL");
$last_row    = $r3->fetch_assoc();
$last_session = $last_row['last'] ? date('M j, g:i A', strtotime($last_row['last'])) : 'No sessions yet';

// Pending issues
$r4 = $conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE user_id = $classrep_id AND status = 'pending'");
$pending_issues = $r4->fetch_assoc()['c'];

// Chart — last 7 days
$chart = [];
for ($i = 6; $i >= 0; $i--) {
    $d   = date('Y-m-d', strtotime("-$i days"));
    $day = date('D', strtotime($d));
    $rc  = $conn->query("SELECT COUNT(*) AS c FROM attendance WHERE classrep_id = $classrep_id AND attendance_date = '$d' AND deleted_at IS NULL");
    $chart[] = ['day' => $day, 'count' => (int)$rc->fetch_assoc()['c']];
}

// Recent attendance (last 10)
$stmt = $conn->prepare("SELECT student_name, index_number, lecture_name, attendance_date, status FROM attendance WHERE classrep_id = ? AND deleted_at IS NULL ORDER BY time_marked DESC LIMIT 10");
$stmt->bind_param('i', $classrep_id);
$stmt->execute();
$recent = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

json_ok([
    'stats' => [
        'total_students'   => (int)$total_students,
        'attendance_today' => (int)$attendance_today,
        'last_session'     => $last_session,
        'pending_issues'   => (int)$pending_issues,
    ],
    'chart'              => $chart,
    'recent_attendance'  => $recent,
]);
