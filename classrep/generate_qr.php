<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_auth($conn);
$classrep_id = $user['id'];
$body        = get_body();

$lecture_name = trim($body['lecture_name'] ?? 'Lecture 1');
$lat          = isset($body['lat']) && $body['lat'] !== '' ? (float)$body['lat'] : null;
$lng          = isset($body['lng']) && $body['lng'] !== '' ? (float)$body['lng'] : null;
$radius_m     = isset($body['radius_m'])   ? (int)$body['radius_m']   : 100;

if ($lat === null || $lng === null) json_error('Classroom location (lat/lng) is required.');
if (!$lecture_name)                 json_error('Lecture name is required.');

try { $code = random_int(1000, 9999); } catch (Exception $e) { $code = mt_rand(1000, 9999); }
$token = bin2hex(random_bytes(8));

$stmt = $conn->prepare("INSERT INTO qr_sessions (token, classrep_id, code, lecture_name, lat, lng, radius_m, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())");
$stmt->bind_param('siisddi', $token, $classrep_id, $code, $lecture_name, $lat, $lng, $radius_m);

if (!$stmt->execute()) json_error('Failed to create session: ' . $stmt->error);

$session_id = $conn->insert_id;

// Build attendance URL — React frontend route
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$frontend_base = getenv('FRONTEND_URL') ?: 'https://class-iq.netlify.app';
$attendance_url = "{$frontend_base}/mark-attendance?classrep_id={$classrep_id}&code={$code}&lecture=" . urlencode($lecture_name);

json_ok([
    'session' => [
        'id'           => $session_id,
        'code'         => $code,
        'lecture_name' => $lecture_name,
        'lat'          => $lat,
        'lng'          => $lng,
        'radius_m'     => $radius_m,
        'attendance_url' => $attendance_url,
    ],
    'attendance_url' => $attendance_url,
]);
