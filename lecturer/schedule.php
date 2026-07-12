<?php
// api/lecturer/schedule.php — Semester → Week → Class hierarchy
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);
$method      = $_SERVER['REQUEST_METHOD'];

function verify_semester_owner(mysqli $conn, int $semester_id, int $lecturer_id): bool {
    $stmt = $conn->prepare("SELECT id FROM lecturer_semesters WHERE id = ? AND lecturer_id = ? LIMIT 1");
    $stmt->bind_param('ii', $semester_id, $lecturer_id);
    $stmt->execute();
    return (bool)$stmt->get_result()->fetch_assoc();
}

function verify_week_owner(mysqli $conn, int $week_id, int $lecturer_id): ?array {
    $stmt = $conn->prepare("
        SELECT w.id, w.semester_id, w.week_number
        FROM lecturer_weeks w
        JOIN lecturer_semesters s ON s.id = w.semester_id
        WHERE w.id = ? AND s.lecturer_id = ?
        LIMIT 1
    ");
    $stmt->bind_param('ii', $week_id, $lecturer_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

if ($method === 'GET') {
    json_ok(['semesters' => lecturer_schedule_tree($conn, $lecturer_id)]);
}

if ($method === 'POST') {
    $body = get_body();
    $type = trim($body['type'] ?? '');

    if ($type === 'semester') {
        $name = trim($body['name'] ?? '');
        if (!$name) json_error('Semester name is required.');
        $stmt = $conn->prepare("INSERT INTO lecturer_semesters (lecturer_id, name) VALUES (?, ?)");
        $stmt->bind_param('is', $lecturer_id, $name);
        if (!$stmt->execute()) json_error('Failed to add semester: ' . $stmt->error);
        json_ok(['message' => 'Semester added.', 'id' => $conn->insert_id]);
    }

    if ($type === 'week') {
        $semester_id = (int)($body['semester_id'] ?? 0);
        $week_number = (int)($body['week_number'] ?? 0);
        if (!$semester_id || !verify_semester_owner($conn, $semester_id, $lecturer_id)) json_error('Invalid semester.');
        if ($week_number < 1 || $week_number > 52) json_error('Week number must be between 1 and 52.');
        $stmt = $conn->prepare("INSERT INTO lecturer_weeks (semester_id, week_number) VALUES (?, ?)");
        $stmt->bind_param('ii', $semester_id, $week_number);
        if (!$stmt->execute()) {
            if ($conn->errno === 1062) json_error("Week $week_number already exists in this semester.");
            json_error('Failed to add week: ' . $stmt->error);
        }
        json_ok(['message' => 'Week added.', 'id' => $conn->insert_id]);
    }

    if ($type === 'class') {
        $week_id       = (int)($body['week_id'] ?? 0);
        $class_number  = (int)($body['class_number'] ?? 0);
        $topic         = trim($body['topic'] ?? '');
        if (!$week_id || !verify_week_owner($conn, $week_id, $lecturer_id)) json_error('Invalid week.');
        if ($class_number < 1) json_error('Class number must be at least 1.');
        if (!$topic) json_error('Topic is required.');
        $stmt = $conn->prepare("INSERT INTO lecturer_classes (week_id, class_number, topic) VALUES (?, ?, ?)");
        $stmt->bind_param('iis', $week_id, $class_number, $topic);
        if (!$stmt->execute()) {
            if ($conn->errno === 1062) json_error("Class $class_number already exists in this week.");
            json_error('Failed to add class: ' . $stmt->error);
        }
        json_ok(['message' => 'Class added.', 'id' => $conn->insert_id]);
    }

    json_error('Invalid type. Use semester, week, or class.');
}

if ($method === 'PUT') {
    $body = get_body();
    $type = trim($body['type'] ?? '');
    $id   = (int)($body['id'] ?? 0);
    if (!$id) json_error('ID required.');

    if ($type === 'semester') {
        $name = trim($body['name'] ?? '');
        if (!$name) json_error('Semester name is required.');
        if (!verify_semester_owner($conn, $id, $lecturer_id)) json_error('Semester not found.');
        $stmt = $conn->prepare("UPDATE lecturer_semesters SET name = ? WHERE id = ? AND lecturer_id = ?");
        $stmt->bind_param('sii', $name, $id, $lecturer_id);
        if (!$stmt->execute()) json_error('Update failed.');
        json_ok(['message' => 'Semester updated.']);
    }

    if ($type === 'week') {
        $week_number = (int)($body['week_number'] ?? 0);
        if ($week_number < 1) json_error('Week number is required.');
        $week = verify_week_owner($conn, $id, $lecturer_id);
        if (!$week) json_error('Week not found.');
        $stmt = $conn->prepare("UPDATE lecturer_weeks SET week_number = ? WHERE id = ?");
        $stmt->bind_param('ii', $week_number, $id);
        if (!$stmt->execute()) json_error('Update failed.');
        json_ok(['message' => 'Week updated.']);
    }

    if ($type === 'class') {
        $class_number = (int)($body['class_number'] ?? 0);
        $topic        = trim($body['topic'] ?? '');
        if ($class_number < 1 || !$topic) json_error('Class number and topic are required.');
        $ctx = lecturer_class_context($conn, $id, $lecturer_id);
        if (!$ctx) json_error('Class not found.');
        $stmt = $conn->prepare("UPDATE lecturer_classes SET class_number = ?, topic = ? WHERE id = ?");
        $stmt->bind_param('isi', $class_number, $topic, $id);
        if (!$stmt->execute()) json_error('Update failed.');
        json_ok(['message' => 'Class updated.']);
    }

    json_error('Invalid type.');
}

if ($method === 'DELETE') {
    $body = get_body();
    $type = trim($body['type'] ?? '');
    $id   = (int)($body['id'] ?? 0);
    if (!$id) json_error('ID required.');

    if ($type === 'semester') {
        if (!verify_semester_owner($conn, $id, $lecturer_id)) json_error('Semester not found.');
        $weeks = $conn->prepare("SELECT id FROM lecturer_weeks WHERE semester_id = ?");
        $weeks->bind_param('i', $id);
        $weeks->execute();
        foreach ($weeks->get_result()->fetch_all(MYSQLI_ASSOC) as $w) {
            $wid = (int)$w['id'];
            $conn->query("DELETE FROM lecturer_classes WHERE week_id = $wid");
        }
        $conn->query("DELETE FROM lecturer_weeks WHERE semester_id = $id");
        $stmt = $conn->prepare("DELETE FROM lecturer_semesters WHERE id = ? AND lecturer_id = ?");
        $stmt->bind_param('ii', $id, $lecturer_id);
        $stmt->execute();
        json_ok(['message' => 'Semester removed.']);
    }

    if ($type === 'week') {
        if (!verify_week_owner($conn, $id, $lecturer_id)) json_error('Week not found.');
        $conn->query("DELETE FROM lecturer_classes WHERE week_id = $id");
        $stmt = $conn->prepare("DELETE FROM lecturer_weeks WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        json_ok(['message' => 'Week removed.']);
    }

    if ($type === 'class') {
        if (!lecturer_class_context($conn, $id, $lecturer_id)) json_error('Class not found.');
        $stmt = $conn->prepare("DELETE FROM lecturer_classes WHERE id = ?");
        $stmt->bind_param('i', $id);
        $stmt->execute();
        json_ok(['message' => 'Class removed.']);
    }

    json_error('Invalid type.');
}

json_error('Method not allowed', 405);
