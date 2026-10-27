<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user         = require_lecturer($conn);
$lecturer_id  = (int)$user['id'];
ensure_lecturer_schema($conn);
$today        = date('Y-m-d');

$total_students  = (int)$conn->query("SELECT COUNT(*) AS c FROM students WHERE user_id = $lecturer_id")->fetch_assoc()['c'];
$attendance_today = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE lecturer_id = $lecturer_id AND attendance_date = '$today' AND deleted_at IS NULL")->fetch_assoc()['c'];
$total_cohorts   = (int)$conn->query("SELECT COUNT(*) AS c FROM lecturer_cohorts WHERE lecturer_id = $lecturer_id")->fetch_assoc()['c'];
$total_semesters = (int)$conn->query("SELECT COUNT(*) AS c FROM lecturer_semesters WHERE lecturer_id = $lecturer_id")->fetch_assoc()['c'];

$last_row = $conn->query("SELECT MAX(time_marked) AS last FROM attendance WHERE lecturer_id = $lecturer_id AND deleted_at IS NULL")->fetch_assoc();
$last_session = $last_row['last'] ? date('M j, g:i A', strtotime($last_row['last'])) : 'No sessions yet';

$chart = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $chart[] = [
        'day'   => date('D', strtotime($d)),
        'count' => (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE lecturer_id = $lecturer_id AND attendance_date = '$d' AND deleted_at IS NULL")->fetch_assoc()['c'],
    ];
}

$session_stats = $conn->query("
    SELECT ls.id AS session_id, co.name AS class_name, ls.topic,
           w.week_number, s.name AS semester_name,
           COUNT(a.id) AS total_marks,
           SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
           SUM(CASE WHEN a.status = 'Flagged' THEN 1 ELSE 0 END) AS flagged_count,
           MAX(a.attendance_date) AS last_date
    FROM lecturer_sessions ls
    JOIN lecturer_cohorts co ON co.id = ls.cohort_id
    JOIN lecturer_weeks w ON w.id = ls.week_id
    JOIN lecturer_semesters s ON s.id = w.semester_id
    LEFT JOIN attendance a ON a.session_id = ls.id AND a.lecturer_id = $lecturer_id AND a.deleted_at IS NULL
    WHERE s.lecturer_id = $lecturer_id
    GROUP BY ls.id
    ORDER BY s.name ASC, w.week_number ASC, co.name ASC
")->fetch_all(MYSQLI_ASSOC);

$students_by_class = lecturer_cohorts_with_students($conn, $lecturer_id);

json_ok([
    'user' => [
        'id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'],
        'institution' => $user['institution'] ?? '', 'course' => $user['course'] ?? '',
    ],
    'stats' => [
        'total_students'   => $total_students,
        'attendance_today' => $attendance_today,
        'total_classes'    => $total_cohorts,
        'total_semesters'  => $total_semesters,
        'last_session'     => $last_session,
    ],
    'chart'             => $chart,
    'session_stats'     => $session_stats,
    'class_stats'       => $session_stats,
    'students_by_class' => $students_by_class,
]);
