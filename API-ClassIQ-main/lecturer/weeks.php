<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error('Use /lecturer/schedule.php for create, update and delete.', 400);
}

$tree = lecturer_schedule_tree($conn, $lecturer_id);
$flat = [];
foreach ($tree['semesters'] as $sem) {
    foreach ($sem['weeks'] as $week) {
        foreach ($week['sessions'] as $sess) {
            $flat[] = [
                'id'            => $sess['id'],
                'session_id'    => $sess['id'],
                'semester_id'   => $sem['id'],
                'semester_name' => $sem['name'],
                'week_id'       => $week['id'],
                'week_number'   => $week['week_number'],
                'cohort_id'     => $sess['cohort_id'],
                'class_name'    => $sess['class_name'],
                'topic'         => $sess['topic'],
                'created_at'    => $sess['created_at'],
            ];
        }
    }
}

json_ok(['sessions' => $flat, 'semesters' => $tree['semesters'], 'cohorts' => $tree['cohorts']]);
