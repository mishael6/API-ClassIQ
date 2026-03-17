<?php
// api/admin/dashboard.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$stats = [];
$stats['total_classreps']   = (int)$conn->query("SELECT COUNT(*) AS c FROM users")->fetch_assoc()['c'];
$stats['total_students']    = (int)$conn->query("SELECT COUNT(*) AS c FROM students")->fetch_assoc()['c'];
$stats['total_sessions']    = (int)$conn->query("SELECT COUNT(*) AS c FROM qr_sessions")->fetch_assoc()['c'];
$stats['total_attendance']  = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE deleted_at IS NULL")->fetch_assoc()['c'];
$stats['pending_issues']    = (int)$conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE status='pending'")->fetch_assoc()['c'];
$stats['today_attendance']  = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE attendance_date=CURDATE() AND deleted_at IS NULL")->fetch_assoc()['c'];
$stats['flagged_total']     = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE status='Flagged' AND deleted_at IS NULL")->fetch_assoc()['c'];
$stats['outside_total']     = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE status='Outside' AND deleted_at IS NULL")->fetch_assoc()['c'];
$stats['active_sessions']   = (int)$conn->query("SELECT COUNT(*) AS c FROM qr_sessions WHERE ended_at IS NULL")->fetch_assoc()['c'];
$stats['resolved_issues']   = (int)$conn->query("SELECT COUNT(*) AS c FROM troubleshooting_logs WHERE status='resolved'")->fetch_assoc()['c'];

$chart = [];
for ($i = 13; $i >= 0; $i--) {
    $d    = date('Y-m-d', strtotime("-$i days"));
    $day  = date('M j', strtotime($d));
    $count = (int)$conn->query("SELECT COUNT(*) AS c FROM attendance WHERE attendance_date='$d' AND deleted_at IS NULL")->fetch_assoc()['c'];
    $chart[] = ['day' => $day, 'count' => $count];
}

json_ok(['stats' => $stats, 'chart' => $chart]);
