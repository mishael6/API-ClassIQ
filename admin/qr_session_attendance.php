<?php
// api/admin/qr_session_attendance.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);
require_once __DIR__ . '/../lib/lecturer_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed.', 405);

ensure_lecturer_schema($conn);

$session_id = (int)($_GET['session_id'] ?? 0);
if (!$session_id) json_error('QR session ID is required.', 400);

$session_stmt = $conn->prepare("
    SELECT q.*, cr.name AS classrep_name, lecturer.name AS lecturer_name
    FROM qr_sessions q
    LEFT JOIN users cr ON cr.id = q.classrep_id
    LEFT JOIN users lecturer ON lecturer.id = q.lecturer_id
    WHERE q.id = ?
    LIMIT 1
");
$session_stmt->bind_param('i', $session_id);
$session_stmt->execute();
$session = $session_stmt->get_result()->fetch_assoc();
if (!$session) json_error('QR session not found.', 404);

$search = trim($_GET['search'] ?? '');
$limit  = min(max((int)($_GET['limit'] ?? 25), 1), 100);
$offset = max((int)($_GET['offset'] ?? 0), 0);
$like = '%' . $search . '%';

if ($search !== '') {
    $count_stmt = $conn->prepare("SELECT COUNT(*) AS total FROM attendance a LEFT JOIN students s ON s.id = a.student_id WHERE a.qr_session_id = ? AND a.deleted_at IS NULL AND (a.student_name LIKE ? OR a.index_number LIKE ? OR s.program LIKE ?)");
    $count_stmt->bind_param('isss', $session_id, $like, $like, $like);
} else {
    $count_stmt = $conn->prepare("SELECT COUNT(*) AS total FROM attendance a WHERE a.qr_session_id = ? AND a.deleted_at IS NULL");
    $count_stmt->bind_param('i', $session_id);
}
$count_stmt->execute();
$total = (int)$count_stmt->get_result()->fetch_assoc()['total'];

if ($search !== '') {
    $students_stmt = $conn->prepare("SELECT a.student_id, a.student_name AS name, a.index_number, a.time_marked, a.status AS attendance_status, s.program, s.level FROM attendance a LEFT JOIN students s ON s.id = a.student_id WHERE a.qr_session_id = ? AND a.deleted_at IS NULL AND (a.student_name LIKE ? OR a.index_number LIKE ? OR s.program LIKE ?) ORDER BY a.time_marked ASC LIMIT ? OFFSET ?");
    $students_stmt->bind_param('isssii', $session_id, $like, $like, $like, $limit, $offset);
} else {
    $students_stmt = $conn->prepare("SELECT a.student_id, a.student_name AS name, a.index_number, a.time_marked, a.status AS attendance_status, s.program, s.level FROM attendance a LEFT JOIN students s ON s.id = a.student_id WHERE a.qr_session_id = ? AND a.deleted_at IS NULL ORDER BY a.time_marked ASC LIMIT ? OFFSET ?");
    $students_stmt->bind_param('iii', $session_id, $limit, $offset);
}
$students_stmt->execute();
$students = $students_stmt->get_result()->fetch_all(MYSQLI_ASSOC);

json_ok([
    'session' => $session,
    'students' => $students,
    'total' => $total,
]);
