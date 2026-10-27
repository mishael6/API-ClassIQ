<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$lecturer_id = (int)($_GET['lecturer_id'] ?? 0);
$cohort_id   = (int)($_GET['class_id'] ?? $_GET['cohort_id'] ?? 0);
if (!$lecturer_id) json_error('Invalid lecturer ID.');

ensure_lecturer_schema($conn);

$stmt = $conn->prepare("SELECT id, name, institution, course FROM users WHERE id = ? AND role = 'lecturer' AND status = 'approved' LIMIT 1");
$stmt->bind_param('i', $lecturer_id);
$stmt->execute();
$lecturer = $stmt->get_result()->fetch_assoc();
if (!$lecturer) json_error('Lecturer not found.');

$class = null;
if ($cohort_id) {
    $class = lecturer_cohort_context($conn, $cohort_id, $lecturer_id);
    if (!$class) json_error('Class not found.');
}

json_ok(['lecturer' => $lecturer, 'class' => $class, 'success' => true]);
