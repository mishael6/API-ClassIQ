<?php
// api/db.php
// Copy your existing credentials here

define('DB_HOST', 'sql206.infinityfree.com');
define('DB_USER', 'if0_39634628');
define('DB_PASS', '2wKy27QJ1wA');
define('DB_NAME', 'if0_39634628_classiq');

$conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}
$conn->set_charset('utf8mb4');
