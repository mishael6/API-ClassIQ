
<?php
// Database credentials from Render environment variables
$host   = getenv('DB_HOST');
$port   = getenv('DB_PORT');
$user   = getenv('DB_USER');
$pass   = getenv('DB_PASS');
$dbname = getenv('DB_NAME');

if (!$host || !$user || !$pass || !$dbname) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database not configured'
    ]);
    exit;
}

// TiDB TLS certificate
$caPath = __DIR__ . '/certs/isrgrootx1.pem';

if (!file_exists($caPath)) {
    http_response_code(500);
    error_log('Database CA certificate not found: ' . $caPath);
    echo json_encode([
        'success' => false,
        'message' => 'Database security configuration error'
    ]);
    exit;
}

// Initialize MySQLi connection
$conn = mysqli_init();

if (!$conn) {
    http_response_code(500);
    error_log('Failed to initialize MySQLi');
    echo json_encode([
        'success' => false,
        'message' => 'Database connection initialization failed'
    ]);
    exit;
}

// Configure TLS with CA certificate
mysqli_ssl_set($conn, NULL, NULL, $caPath, NULL, NULL);

// Connect using TLS and verify the server identity
$connected = mysqli_real_connect(
    $conn,
    $host,
    $user,
    $pass,
    $dbname,
    (int)($port ?: 4000),
    NULL,
    MYSQLI_CLIENT_SSL | MYSQLI_CLIENT_SSL_VERIFY_SERVER_CERT
);

if (!$connected) {
    http_response_code(500);
    error_log('Database connection failed: ' . mysqli_connect_error());
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed'
    ]);
    exit;
}

// Use UTF-8 for database communication
if (!$conn->set_charset('utf8mb4')) {
    http_response_code(500);
    error_log('Failed to set database charset: ' . $conn->error);
    echo json_encode([
        'success' => false,
        'message' => 'Database configuration failed'
    ]);
    $conn->close();
    exit;
}
