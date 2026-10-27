<?php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';

$user        = require_lecturer($conn);
$lecturer_id = (int)$user['id'];
ensure_lecturer_schema($conn);

$conn->query("
    CREATE TABLE IF NOT EXISTS lecturer_saved_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lecturer_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        radius_m INT NOT NULL DEFAULT 100,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (lecturer_id)
    )
");

$method = $_SERVER['REQUEST_METHOD'];
$body   = get_body();
if ($method === 'POST' && isset($body['_method'])) {
    $method = strtoupper($body['_method']);
}

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, name, lat, lng, radius_m FROM lecturer_saved_locations WHERE lecturer_id = ? ORDER BY created_at DESC");
    $stmt->bind_param('i', $lecturer_id);
    $stmt->execute();
    json_ok(['locations' => $stmt->get_result()->fetch_all(MYSQLI_ASSOC)]);
}

if ($method === 'POST') {
    $name   = trim($body['name'] ?? '');
    $lat    = (float)($body['lat'] ?? 0);
    $lng    = (float)($body['lng'] ?? 0);
    $radius = (int)($body['radius_m'] ?? 100);

    if (!$name || !$lat || !$lng) json_error('Name, latitude and longitude are required.');

    $stmt = $conn->prepare("INSERT INTO lecturer_saved_locations (lecturer_id, name, lat, lng, radius_m) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param('isddi', $lecturer_id, $name, $lat, $lng, $radius);
    if (!$stmt->execute()) json_error('Failed to save location.');
    json_ok(['message' => 'Location saved.', 'id' => $conn->insert_id]);
}

if ($method === 'DELETE') {
    $id = (int)($body['id'] ?? 0);
    if (!$id) json_error('Location ID required.');
    $stmt = $conn->prepare("DELETE FROM lecturer_saved_locations WHERE id = ? AND lecturer_id = ?");
    $stmt->bind_param('ii', $id, $lecturer_id);
    $stmt->execute();
    json_ok(['deleted' => $stmt->affected_rows > 0]);
}

json_error('Method not allowed', 405);
