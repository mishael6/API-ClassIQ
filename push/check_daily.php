<?php
// api/push/check_daily.php — fallback: mobile app calls on open to trigger morning push
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/automated.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$hour = (int)date('G');
if ($hour < 6 || $hour > 11) {
    json_ok(['triggered' => false, 'reason' => 'Outside morning window.']);
}

$motivation = send_morning_motivation($conn);
$feature    = null;

// Feature tip only if today is Mon/Wed/Fri
if (in_array((int)date('N'), [1, 3, 5])) {
    $feature = send_feature_tip($conn);
}

json_ok([
    'triggered'  => true,
    'motivation' => $motivation,
    'feature'    => $feature,
]);
