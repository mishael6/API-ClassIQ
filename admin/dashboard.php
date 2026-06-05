<?php
// api/admin/dashboard.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$stats = [];
$stats['total_classreps']   = (int)$conn->query("SELECT COUNT(*) AS c FROM users WHERE role = 'class_rep'")->fetch_assoc()['c'];
$stats['total_students']    = (int)$conn->query("SELECT COUNT(*) AS c FROM students")->fetch_assoc()['c'];
$stats['total_sessions']    = (int)$conn->query("SELECT COUNT(*) AS c FROM qr_sessions")->fetch_assoc()['c'];
$stats['total_attendance']  = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE deleted_at IS NULL")->fetch_assoc()['c'];
$stats['pending_issues']    = (int)$conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE status='pending'")->fetch_assoc()['c'];
$stats['today_attendance']  = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE attendance_date=CURDATE() AND deleted_at IS NULL")->fetch_assoc()['c'];
$stats['flagged_total']     = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE status='Flagged' AND deleted_at IS NULL")->fetch_assoc()['c'];
$stats['outside_total']     = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE status='Outside' AND deleted_at IS NULL")->fetch_assoc()['c'];
$stats['active_sessions']   = (int)$conn->query("SELECT COUNT(*) AS c FROM qr_sessions WHERE ended_at IS NULL")->fetch_assoc()['c'];
$stats['resolved_issues']   = (int)$conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE status='resolved'")->fetch_assoc()['c'];
$stats['app_downloads']     = (int)$conn->query("SELECT COUNT(*) AS c FROM app_downloads")->fetch_assoc()['c'];

// ── Students online (last seen in last 5 minutes) ──
$stats['students_online'] = (int)$conn->query("
    SELECT COUNT(*) AS c FROM students
    WHERE last_seen >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
")->fetch_assoc()['c'];

// ── Mobile app signups (students with a password — registered via mobile app) ──
$stats['mobile_signups'] = (int)$conn->query("
    SELECT COUNT(*) AS c FROM students
    WHERE password IS NOT NULL AND password != ''
    AND user_id IS NULL
")->fetch_assoc()['c'];

// ── Active AI subscriptions ──
$stats['active_subscriptions'] = (int)$conn->query("
    SELECT COUNT(*) AS c FROM ai_subscriptions
    WHERE status = 'active' AND end_date >= CURDATE()
")->fetch_assoc()['c'];

// ── Total AI subscription revenue ──
$stats['subscription_revenue'] = (float)$conn->query("
    SELECT COALESCE(SUM(amount), 0) AS total FROM ai_subscriptions
    WHERE status = 'active'
")->fetch_assoc()['total'];

// ── Subscriptions with days remaining ──
$subscriptions = $conn->query("
    SELECT
        s.name AS student_name,
        s.index_number,
        s.institution,
        sub.amount,
        sub.start_date,
        sub.end_date,
        sub.status,
        DATEDIFF(sub.end_date, CURDATE()) AS days_remaining
    FROM ai_subscriptions sub
    JOIN students s ON s.id = sub.student_id
    WHERE sub.status = 'active' AND sub.end_date >= CURDATE()
    ORDER BY sub.end_date ASC
")->fetch_all(MYSQLI_ASSOC);

// ── New students this week ──
$stats['new_students_week'] = (int)$conn->query("
    SELECT COUNT(*) AS c FROM students
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
")->fetch_assoc()['c'];

// ── New students this month ──
$stats['new_students_month'] = (int)$conn->query("
    SELECT COUNT(*) AS c FROM students
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
")->fetch_assoc()['c'];

// ── Chart last 14 days ──
$chart = [];
for ($i = 13; $i >= 0; $i--) {
    $d     = date('Y-m-d', strtotime("-$i days"));
    $day   = date('M j', strtotime($d));
    $count = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE attendance_date='$d' AND deleted_at IS NULL")->fetch_assoc()['c'];
    $chart[] = ['day' => $day, 'count' => $count];
}

// ── Student signups last 14 days chart ──
$signup_chart = [];
for ($i = 13; $i >= 0; $i--) {
    $d     = date('Y-m-d', strtotime("-$i days"));
    $day   = date('M j', strtotime($d));
    $count = (int)$conn->query("SELECT COUNT(*) AS c FROM students WHERE DATE(created_at) = '$d'")->fetch_assoc()['c'];
    $signup_chart[] = ['day' => $day, 'count' => $count];
}

json_ok([
    'stats'         => $stats,
    'chart'         => $chart,
    'signup_chart'  => $signup_chart,
    'subscriptions' => $subscriptions,
]);
