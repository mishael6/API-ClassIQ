<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);
$body        = get_body();

$session_id = (int)($body['session_id'] ?? $body['class_id'] ?? 0);
$lat        = isset($body['lat']) && $body['lat'] !== '' ? (float)$body['lat'] : null;
$lng        = isset($body['lng']) && $body['lng'] !== '' ? (float)$body['lng'] : null;
$radius_m   = isset($body['radius_m']) ? (int)$body['radius_m'] : 100;

if (!$session_id) json_error('Please select semester, week, class and topic.');
if ($lat === null || $lng === null) json_error('Classroom location (lat/lng) is required.');

$ctx = lecturer_session_context($conn, $session_id, $lecturer_id);
if (!$ctx) json_error('Session not found. Add it under Schedule first.');

$topic         = $ctx['topic'];
$week_number   = (int)$ctx['week_number'];
$class_name    = $ctx['class_name'];
$cohort_id     = (int)$ctx['cohort_id'];
$semester_id   = (int)$ctx['semester_id'];
$semester_name = $ctx['semester_name'];

try { $code = random_int(1000, 9999); } catch (Exception $e) { $code = mt_rand(1000, 9999); }
$token = bin2hex(random_bytes(8));

$stmt = $conn->prepare("
    INSERT INTO qr_sessions (token, lecturer_id, code, lecture_name, week_number, session_id, cohort_id, semester_id, class_name, lat, lng, radius_m, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
");
$stmt->bind_param('siisiiiisddi', $token, $lecturer_id, $code, $topic, $week_number, $session_id, $cohort_id, $semester_id, $class_name, $lat, $lng, $radius_m);

if (!$stmt->execute()) json_error('Failed to create session: ' . $stmt->error);

$session_row_id = $conn->insert_id;
$frontend_base    = student_frontend_url();
$attendance_url   = "{$frontend_base}/mark-attendance?lecturer_id={$lecturer_id}&code={$code}&session_id={$session_id}&semester=" . urlencode($semester_name) . "&week={$week_number}&class=" . urlencode($class_name) . "&topic=" . urlencode($topic);

json_ok([
    'session' => [
        'id'             => $session_row_id,
        'code'           => $code,
        'session_id'     => $session_id,
        'cohort_id'      => $cohort_id,
        'class_name'     => $class_name,
        'semester_id'    => $semester_id,
        'semester_name'  => $semester_name,
        'week_number'    => $week_number,
        'topic'          => $topic,
        'lecture_name'   => $topic,
        'lat'            => $lat,
        'lng'            => $lng,
        'radius_m'       => $radius_m,
        'attendance_url' => $attendance_url,
    ],
    'attendance_url' => $attendance_url,
]);
