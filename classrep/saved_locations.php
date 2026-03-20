<?php
// api/classrep/saved_locations.php
require_once __DIR__ . '/../bootstrap.php';
$user = require_auth($conn);

if ($user['role'] !== 'class_rep' && $user['role'] !== 'classrep') {
    json_error('Unauthorized', 403);
}

// Ensure the `saved_locations` table exists dynamically on first use
$conn->query("
    CREATE TABLE IF NOT EXISTS saved_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        classrep_id INT NOT NULL,
        name VARCHAR(100) NOT NULL,
        lat DECIMAL(10, 8) NOT NULL,
        lng DECIMAL(11, 8) NOT NULL,
        radius_m INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (classrep_id)
    )
");

$method = $_SERVER['REQUEST_METHOD'];
$body   = get_body();
if ($method === 'POST' && isset($body['_method'])) {
    $method = strtoupper($body['_method']);
}

// --- CRUD MAPPER ---

if ($method === 'GET') {
    $stmt = $conn->prepare("SELECT id, name, lat, lng, radius_m FROM saved_locations WHERE classrep_id = ? ORDER BY created_at DESC");
    $stmt->bind_param('i', $user['id']);
    $stmt->execute();
    $locations = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    json_ok(['locations' => $locations]);

} elseif ($method === 'POST') {
    $name   = trim($body['name'] ?? '');
    $lat    = (float)($body['lat'] ?? 0);
    $lng    = (float)($body['lng'] ?? 0);
    $radius = (int)($body['radius_m'] ?? 100);

    if (!$name || !$lat || !$lng) json_error('Name, Latitude, and Longitude are required.');

    $stmt = $conn->prepare("INSERT INTO saved_locations (classrep_id, name, lat, lng, radius_m) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param('isddi', $user['id'], $name, $lat, $lng, $radius);
    
    if ($stmt->execute()) {
        json_ok(['id' => $conn->insert_id]);
    } else {
        json_error('Failed to save location.');
    }

} elseif ($method === 'DELETE') {
    $id = (int)($body['id'] ?? 0);
    if (!$id) json_error('Location ID is required.');

    $stmt = $conn->prepare("DELETE FROM saved_locations WHERE id = ? AND classrep_id = ?");
    $stmt->bind_param('ii', $id, $user['id']);
    $stmt->execute();
    json_ok(['deleted' => $stmt->affected_rows > 0]);

} else {
    json_error('Method Not Allowed', 405);
}
