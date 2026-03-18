<?php
// Railway provides these environment variables automatically
// when a MySQL service is in the same project
$host   = getenv('MYSQLHOST')     ?: getenv('DB_HOST') ?: 'localhost';
$port   = getenv('MYSQLPORT')     ?: getenv('DB_PORT') ?: '3306';
$user   = getenv('MYSQLUSER')     ?: getenv('DB_USER') ?: 'root';
$pass   = getenv('MYSQLPASSWORD') ?: getenv('DB_PASS') ?: '';
$dbname = getenv('MYSQLDATABASE') ?: getenv('DB_NAME') ?: 'railway';

$conn = new mysqli($host, $user, $pass, $dbname, (int)$port);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'DB connection failed: ' . $conn->connect_error
    ]);
    exit;
}

$conn->set_charset('utf8mb4');
ini_set('log_errors', 1);
ini_set('error_log', '/tmp/php_errors.log');
