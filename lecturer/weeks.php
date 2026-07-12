<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);
$method      = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, week_number, topic, created_at FROM lecturer_weeks WHERE lecturer_id = ? ORDER BY week_number ASC");
    $stmt->bind_param('i', $lecturer_id);
    $stmt->execute();
    json_ok(['weeks' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($method === 'POST') {
    $body        = get_body();
    $week_number = (int)($body['week_number'] ?? 0);
    $topic       = trim($body['topic'] ?? '');

    if ($week_number < 1 || $week_number > 52) json_error('Week number must be between 1 and 52.');
    if (!$topic) json_error('Topic is required.');

    $stmt = $conn->prepare("INSERT INTO lecturer_weeks (lecturer_id, week_number, topic) VALUES (?, ?, ?)");
    $stmt->bind_param('iis', $lecturer_id, $week_number, $topic);
    if (!$stmt->execute()) {
        if ($conn->errno === 1062) json_error("Week $week_number already exists. Edit it instead.");
        json_error('Failed to add week: ' . $stmt->error);
    }
    json_ok(['message' => 'Week added.', 'id' => $conn->insert_id]);
}

if ($method === 'PUT') {
    $body        = get_body();
    $id          = (int)($body['id'] ?? 0);
    $week_number = (int)($body['week_number'] ?? 0);
    $topic       = trim($body['topic'] ?? '');

    if (!$id) json_error('Week ID required.');
    if ($week_number < 1 || !$topic) json_error('Week number and topic are required.');

    $stmt = $conn->prepare("UPDATE lecturer_weeks SET week_number = ?, topic = ? WHERE id = ? AND lecturer_id = ?");
    $stmt->bind_param('isii', $week_number, $topic, $id, $lecturer_id);
    if (!$stmt->execute()) json_error('Update failed: ' . $stmt->error);
    json_ok(['message' => 'Week updated.']);
}

if ($method === 'DELETE') {
    $id = (int)(get_body()['id'] ?? 0);
    if (!$id) json_error('Week ID required.');

    $stmt = $conn->prepare("DELETE FROM lecturer_weeks WHERE id = ? AND lecturer_id = ?");
    $stmt->bind_param('ii', $id, $lecturer_id);
    $stmt->execute();
    json_ok(['message' => 'Week removed.']);
}

json_error('Method not allowed', 405);
