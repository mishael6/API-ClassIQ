<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);
$body        = get_body();

$week_number = (int)($body['week_number'] ?? 0);
$lat         = isset($body['lat']) && $body['lat'] !== '' ? (float)$body['lat'] : null;
$lng         = isset($body['lng']) && $body['lng'] !== '' ? (float)$body['lng'] : null;
$radius_m    = isset($body['radius_m']) ? (int)$body['radius_m'] : 100;

if (!$week_number) json_error('Please select a week.');
if ($lat === null || $lng === null) json_error('Classroom location (lat/lng) is required.');

$wk = $conn->prepare("SELECT topic FROM lecturer_weeks WHERE lecturer_id = ? AND week_number = ? LIMIT 1");
$wk->bind_param('ii', $lecturer_id, $week_number);
$wk->execute();
$week = $wk->get_result()->fetch_assoc();
if (!$week) json_error('Week not found. Add it under Weeks first.');

$topic = $week['topic'];
try { $code = random_int(1000, 9999); } catch (Exception $e) { $code = mt_rand(1000, 9999); }
$token = bin2hex(random_bytes(8));
$stmt = $conn->prepare("
    INSERT INTO qr_sessions (token, lecturer_id, code, lecture_name, week_number, lat, lng, radius_m, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param('siisiddi', $token, $lecturer_id, $code, $topic, $week_number, $lat, $lng, $radius_m);

if (!$stmt->execute()) json_error('Failed to create session: ' . $stmt->error);

$session_id = $conn->insert_id;
$frontend_base = getenv('FRONTEND_URL') ?: 'https://app-class-iq.netlify.app';
$attendance_url = "{$frontend_base}/mark-attendance?lecturer_id={$lecturer_id}&code={$code}&week={$week_number}&topic=" . urlencode($topic);

json_ok([
    'session' => [
        'id'           => $session_id,
        'code'         => $code,
        'week_number'  => $week_number,
        'topic'        => $topic,
        'lecture_name' => $topic,
        'lat'          => $lat,
        'lng'          => $lng,
        'radius_m'     => $radius_m,
        'attendance_url' => $attendance_url,
    ],
    'attendance_url' => $attendance_url,
]);
