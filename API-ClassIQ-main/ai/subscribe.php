<?php
// api/ai/subscribe.php — Six no longer charges. Kept so older app builds do not hit a missing route.
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$student_id = (int)($body['student_id'] ?? 0);
if (!$student_id) json_error('Student ID required.');

json_ok([
    'message'    => 'Six is free. No payment is required.',
    'subscribed' => true,
    'free'       => true,
    'amount'     => 0,
]);
