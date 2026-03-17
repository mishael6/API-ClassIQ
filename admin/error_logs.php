<?php
// api/admin/error_logs.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$log_path = ini_get('error_log');
$logs     = [];

if ($log_path && file_exists($log_path) && is_readable($log_path)) {
    $lines = array_filter(array_map('trim', array_slice(file($log_path), -100)));
    foreach (array_reverse(array_values($lines)) as $line) {
        // Parse PHP error log format: [DD-Mon-YYYY HH:MM:SS UTC] PHP ...
        if (preg_match('/^\[([^\]]+)\]\s+(.+)$/', $line, $m)) {
            $logs[] = ['time' => $m[1], 'message' => $m[2]];
        } else {
            $logs[] = ['time' => '', 'message' => $line];
        }
        if (count($logs) >= 50) break;
    }
} else {
    // Check for a custom error log in the api directory
    $custom = __DIR__ . '/../../logs/error.log';
    if (file_exists($custom) && is_readable($custom)) {
        $lines = array_filter(array_map('trim', array_slice(file($custom), -100)));
        foreach (array_reverse(array_values($lines)) as $line) {
            $logs[] = ['time' => '', 'message' => $line];
            if (count($logs) >= 50) break;
        }
    }
}

json_ok(['logs' => $logs]);
