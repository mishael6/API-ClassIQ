<?php
// api/classrep/saved_lectures.php
require_once __DIR__ . '/../bootstrap.php';
$user = require_auth($conn);

if ($user['role'] !== 'class_rep' && $user['role'] !== 'classrep') {
    json_error('Unauthorized', 403);
}

$conn->query("
    CREATE TABLE IF NOT EXISTS saved_lectures (
        id INT AUTO_INCREMENT PRIMARY KEY,
        classrep_id INT NOT NULL,
        name VARCHAR(150) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_classrep_lecture (classrep_id, name),
        INDEX (classrep_id)
    )
");

$method = $_SERVER['REQUEST_METHOD'];
$body   = get_body();
if ($method === 'POST' && isset($body['_method'])) {
    $method = strtoupper($body['_method']);
}

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, name FROM saved_lectures WHERE classrep_id = ? ORDER BY created_at ASC");
    $stmt->bind_param('i', $user['id']);
    $stmt->execute();
    $lectures = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    json_ok(['lectures' => $lectures]);

} elseif ($method === 'POST') {
    $name = trim($body['name'] ?? '');
    if (!$name) json_error('Lecture name is required.');
    if (strlen($name) > 150) json_error('Lecture name is too long (max 150 characters).');

    $dup = $conn->prepare("SELECT id FROM saved_lectures WHERE classrep_id = ? AND name = ? LIMIT 1");
    $dup->bind_param('is', $user['id'], $name);
    $dup->execute();
    if ($dup->get_result()->num_rows > 0) {
        json_error('This lecture name already exists.');
    }

    $stmt = $conn->prepare("INSERT INTO saved_lectures (classrep_id, name) VALUES (?, ?)");
    $stmt->bind_param('is', $user['id'], $name);

    if ($stmt->execute()) {
        json_ok(['id' => $conn->insert_id, 'name' => $name]);
    }
    json_error('Failed to save lecture name.');

} elseif ($method === 'DELETE') {
    $id = (int)($body['id'] ?? 0);
    if (!$id) json_error('Lecture ID is required.');

    $stmt = $conn->prepare("DELETE FROM saved_lectures WHERE id = ? AND classrep_id = ?");
    $stmt->bind_param('ii', $id, $user['id']);
    $stmt->execute();
    json_ok(['deleted' => $stmt->affected_rows > 0]);

} else {
    json_error('Method Not Allowed', 405);
}
