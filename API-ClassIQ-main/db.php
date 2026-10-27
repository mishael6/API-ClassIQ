<?php
// All credentials come from environment variables (set in Render dashboard)
$host   = getenv('DB_HOST');
$port   = getenv('DB_PORT');
$user   = getenv('DB_USER');
$pass   = getenv('DB_PASS');
$dbname = getenv('DB_NAME');

if (!$host || !$user || !$pass || !$dbname) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database not configured']);
    exit;
}

$conn = mysqli_init();
mysqli_ssl_set($conn, NULL, NULL, NULL, NULL, NULL);

$connected = mysqli_real_connect(
    $conn, $host, $user, $pass, $dbname,
    (int)($port ?: 3306), NULL, MYSQLI_CLIENT_SSL
);

if (!$connected) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'DB connection failed: ' . mysqli_connect_error()]);
    exit;
}

$conn->set_charset('utf8mb4');
