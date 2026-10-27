<?php
// api/admin/daily_attendance.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$date = $conn->real_escape_string($_GET['date'] ?? date('Y-m-d'));

// ── Overall stats ─────────────────────────────────────────────
$active_classreps = (int)$conn->query("
    SELECT COUNT(DISTINCT classrep_id) AS c
    FROM attendance
    WHERE attendance_date = '$date' AND deleted_at IS NULL
")->fetch_assoc()['c'];

$total_students_marked = (int)$conn->query("
    SELECT COUNT(*) AS c
    FROM attendance
    WHERE attendance_date = '$date' AND deleted_at IS NULL
")->fetch_assoc()['c'];

$total_lectures = (int)$conn->query("
    SELECT COUNT(DISTINCT CONCAT(classrep_id, '_', lecture_name)) AS c
    FROM attendance
    WHERE attendance_date = '$date' AND deleted_at IS NULL
")->fetch_assoc()['c'];

// ── Per classrep breakdown ────────────────────────────────────
$rows = $conn->query("
    SELECT
        u.id                                          AS classrep_id,
        u.name                                        AS classrep_name,
        u.institution,
        COUNT(DISTINCT q.id)                          AS qr_count,
        ROUND(AVG(
            CASE WHEN q.ended_at IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, q.created_at, q.ended_at)
            ELSE NULL END
        ))                                            AS avg_duration,
        COUNT(a.id)                                   AS students_marked,
        COUNT(DISTINCT a.lecture_name)                AS lectures_count,
        GROUP_CONCAT(DISTINCT a.lecture_name ORDER BY a.lecture_name SEPARATOR '||') AS lectures
    FROM users u
    JOIN attendance a  ON a.classrep_id = u.id
                      AND a.attendance_date = '$date'
                      AND a.deleted_at IS NULL
    LEFT JOIN qr_sessions q ON q.classrep_id = u.id
                            AND DATE(q.created_at) = '$date'
    GROUP BY u.id, u.name, u.institution
    ORDER BY students_marked DESC
")->fetch_all(MYSQLI_ASSOC);

// Split lectures string into array
foreach ($rows as &$row) {
    $row['lectures']      = $row['lectures'] ? explode('||', $row['lectures']) : [];
    $row['qr_count']      = (int)$row['qr_count'];
    $row['avg_duration']  = $row['avg_duration'] ? (int)$row['avg_duration'] : null;
    $row['students_marked'] = (int)$row['students_marked'];
    $row['lectures_count']  = (int)$row['lectures_count'];
}

json_ok([
    'stats' => [
        'active_classreps'     => $active_classreps,
        'total_students_marked'=> $total_students_marked,
        'total_lectures'       => $total_lectures,
    ],
    'classreps' => $rows,
    'date'      => $date,
]);
