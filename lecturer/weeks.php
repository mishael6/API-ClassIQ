<?php
// Backward-compatible alias — returns flat class list for legacy clients
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('Use /lecturer/schedule.php for create, update and delete.', 400);
}

$classes = [];
foreach (lecturer_schedule_tree($conn, $lecturer_id) as $sem) {
    foreach ($sem['weeks'] as $week) {
        foreach ($week['classes'] as $cls) {
            $classes[] = [
                'id'            => $cls['id'],
                'semester_id'   => $sem['id'],
                'semester_name' => $sem['name'],
                'week_id'       => $week['id'],
                'week_number'   => $week['week_number'],
                'class_number'  => $cls['class_number'],
                'topic'         => $cls['topic'],
                'created_at'    => $cls['created_at'],
            ];
        }
    }
}

json_ok(['classes' => $classes, 'semesters' => lecturer_schedule_tree($conn, $lecturer_id)]);
