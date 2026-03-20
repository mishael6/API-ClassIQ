<?php
// api/admin/error_logs.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

// Ensure the `error_logs` table exists just in case GET is called before POST
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

$logs = $conn->query("SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 200")->fetch_all(MYSQLI_ASSOC);

json_ok(['logs' => $logs]);
