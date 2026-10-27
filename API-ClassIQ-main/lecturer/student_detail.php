<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
$student_id  = (int)($_GET['id'] ?? 0);
ensure_lecturer_schema($conn);

if (!$student_id) json_error('Student ID required.');

$stmt = $conn->prepare("
    SELECT s.*, c.name AS class_name
    FROM students s
    LEFT JOIN lecturer_cohorts c ON c.id = s.lecturer_cohort_id
    WHERE s.id = ? AND s.user_id = ?
    LIMIT 1
");
$stmt->bind_param('ii', $student_id, $lecturer_id);
$stmt->execute();
$student = $stmt->get_result()->fetch_assoc();
if (!$student) json_error('Student not found.');

$cohort_id = (int)($student['lecturer_cohort_id'] ?? 0);

$sum = $conn->prepare("
    SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'Flagged' THEN 1 ELSE 0 END) AS flagged,
        COUNT(DISTINCT session_id) AS sessions_attended,
        MAX(attendance_date) AS last_seen
    FROM attendance
    WHERE student_id = ? AND lecturer_id = ? AND deleted_at IS NULL
");
$sum->bind_param('ii', $student_id, $lecturer_id);
$sum->execute();
$summary = $sum->get_result()->fetch_assoc();

$hist = $conn->prepare("
    SELECT a.attendance_date, a.time_marked, a.lecture_name, a.week_number, a.class_name,
           a.status, a.session_id, sem.name AS semester_name
    FROM attendance a
    LEFT JOIN lecturer_semesters sem ON sem.id = a.semester_id
    WHERE a.student_id = ? AND a.lecturer_id = ? AND a.deleted_at IS NULL
    ORDER BY a.attendance_date DESC, a.time_marked DESC
    LIMIT 100
");
$hist->bind_param('ii', $student_id, $lecturer_id);
$hist->execute();
$attended = $hist->get_result()->fetch_all(MYSQLI_ASSOC);

$missed = [];
if ($cohort_id) {
    $miss = $conn->prepare("
        SELECT ls.id AS session_id, ls.topic, w.week_number, sem.name AS semester_name, co.name AS class_name,
               MAX(a2.attendance_date) AS session_date
        FROM lecturer_sessions ls
        JOIN lecturer_weeks w ON w.id = ls.week_id
        JOIN lecturer_semesters sem ON sem.id = w.semester_id
        JOIN lecturer_cohorts co ON co.id = ls.cohort_id
        JOIN attendance a2 ON a2.session_id = ls.id AND a2.lecturer_id = ? AND a2.deleted_at IS NULL
        WHERE ls.cohort_id = ? AND sem.lecturer_id = ?
          AND NOT EXISTS (
              SELECT 1 FROM attendance ax
              WHERE ax.session_id = ls.id AND ax.student_id = ? AND ax.lecturer_id = ? AND ax.deleted_at IS NULL
          )
        GROUP BY ls.id
        ORDER BY session_date DESC, sem.name ASC, w.week_number ASC
        LIMIT 100
    ");
    $miss->bind_param('iiiii', $lecturer_id, $cohort_id, $lecturer_id, $student_id, $lecturer_id);
    $miss->execute();
    $missed = $miss->get_result()->fetch_all(MYSQLI_ASSOC);
}

$summary['sessions_missed'] = count($missed);

json_ok([
    'student'  => $student,
    'summary'  => $summary,
    'attended' => $attended,
    'missed'   => $missed,
    'history'  => $attended,
]);
