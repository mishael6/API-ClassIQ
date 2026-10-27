<?php
// api/push/cron_daily.php — call every morning via cron (e.g. cron-job.org)
// Set PUSH_CRON_SECRET in Render environment variables.
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/automated.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Method not allowed', 405);
}

$secret = getenv('PUSH_CRON_SECRET') ?: '';
$provided = $_GET['secret'] ?? $_SERVER['HTTP_X_CRON_SECRET'] ?? '';

if (!$secret || !hash_equals($secret, $provided)) {
    json_error('Unauthorized', 401);
}

$results = run_daily_push_jobs($conn);

json_ok([
    'message' => 'Daily push jobs completed.',
    'results' => $results,
    'time'    => date('Y-m-d H:i:s'),
]);
