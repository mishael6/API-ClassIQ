<?php
// api/log_error.php
// Public endpoint - Unauthenticated so the frontend can securely POST crash reports natively.
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db.php';

// Ensure the `error_logs` table exists
$conn->query("
    CREATE TABLE IF NOT EXISTS error_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT,
        stack TEXT,
        url VARCHAR(500),
        user_agent VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
");

$body = json_decode(file_get_contents('php://input'), true);

if ($body && isset($body['message'])) {
    $msg   = $conn->real_escape_string($body['message']);
    $stack = $conn->real_escape_string($body['stack'] ?? '');
    $url   = $conn->real_escape_string($body['url'] ?? '');
    $ua    = $conn->real_escape_string($_SERVER['HTTP_USER_AGENT'] ?? '');

    $conn->query("INSERT INTO error_logs (message, stack, url, user_agent) VALUES ('$msg', '$stack', '$url', '$ua')");
}

echo json_encode(['success' => true]);
