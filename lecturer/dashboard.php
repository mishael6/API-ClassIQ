<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user         = require_lecturer($conn);
$lecturer_id  = (int)$user['id'];
ensure_lecturer_schema($conn);
$today        = date('Y-m-d');

$total_students = (int)$conn->query("SELECT COUNT(*) AS c FROM students WHERE user_id = $lecturer_id")->fetch_assoc()['c'];
$attendance_today = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE lecturer_id = $lecturer_id AND attendance_date = '$today' AND deleted_at IS NULL")->fetch_assoc()['c'];
$total_semesters = (int)$conn->query("SELECT COUNT(*) AS c FROM lecturer_semesters WHERE lecturer_id = $lecturer_id")->fetch_assoc()['c'];
$total_classes = (int)$conn->query("
    SELECT COUNT(*) AS c FROM lecturer_classes c
    JOIN lecturer_weeks w ON w.id = c.week_id
    JOIN lecturer_semesters s ON s.id = w.semester_id
    WHERE s.lecturer_id = $lecturer_id
")->fetch_assoc()['c'];

$last_row = $conn->query("SELECT MAX(time_marked) AS last FROM attendance WHERE lecturer_id = $lecturer_id AND deleted_at IS NULL")->fetch_assoc();
$last_session = $last_row['last'] ? date('M j, g:i A', strtotime($last_row['last'])) : 'No sessions yet';

$pending_issues = (int)$conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE user_id = $lecturer_id AND status = 'pending'")->fetch_assoc()['c'];

$chart = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $chart[] = [
        'day'   => date('D', strtotime($d)),
        'count' => (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE lecturer_id = $lecturer_id AND attendance_date = '$d' AND deleted_at IS NULL")->fetch_assoc()['c'],
    ];
}

$class_stats = $conn->query("
    SELECT c.id AS class_id, c.class_number, c.topic,
           w.week_number, s.id AS semester_id, s.name AS semester_name,
           COUNT(a.id) AS total_marks,
           SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
           SUM(CASE WHEN a.status = 'Flagged' THEN 1 ELSE 0 END) AS flagged_count,
           MAX(a.attendance_date) AS last_date
    FROM lecturer_classes c
    JOIN lecturer_weeks w ON w.id = c.week_id
    JOIN lecturer_semesters s ON s.id = w.semester_id
    LEFT JOIN attendance a ON a.class_id = c.id AND a.lecturer_id = $lecturer_id AND a.deleted_at IS NULL
    WHERE s.lecturer_id = $lecturer_id
    GROUP BY c.id
    ORDER BY s.name ASC, w.week_number ASC, c.class_number ASC
")->fetch_all(MYSQLI_ASSOC);

$students = $conn->query("
    SELECT s.id, s.name, s.index_number, s.email, s.phone,
           COUNT(a.id) AS attendance_count,
           SUM(CASE WHEN a.status = 'Present' THEN 1 ELSE 0 END) AS present_count,
           SUM(CASE WHEN a.status = 'Flagged' THEN 1 ELSE 0 END) AS flagged_count,
           MAX(a.attendance_date) AS last_seen
    FROM students s
    LEFT JOIN attendance a ON a.student_id = s.id AND a.lecturer_id = $lecturer_id AND a.deleted_at IS NULL
    WHERE s.user_id = $lecturer_id
    GROUP BY s.id
    ORDER BY s.name ASC
")->fetch_all(MYSQLI_ASSOC);

json_ok([
    'user' => [
        'id' => $user['id'], 'name' => $user['name'], 'email' => $user['email'],
        'institution' => $user['institution'] ?? '', 'course' => $user['course'] ?? '',
    ],
    'stats' => [
        'total_students'   => $total_students,
        'attendance_today' => $attendance_today,
        'total_semesters'  => $total_semesters,
        'total_classes'    => $total_classes,
        'last_session'     => $last_session,
        'pending_issues'   => $pending_issues,
    ],
    'chart'        => $chart,
    'class_stats'  => $class_stats,
    'week_stats'   => $class_stats,
    'students'     => $students,
]);
