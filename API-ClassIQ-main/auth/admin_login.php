<?php
// api/auth/admin_login.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) json_error('Email and password are required.');

// Ensure admins table + session_token column exist
$conn->query("CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    session_token VARCHAR(64) NULL DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_token (session_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
$col = $conn->query("SHOW COLUMNS FROM admins LIKE 'session_token'");
if (!$col || $col->num_rows === 0) {
    $conn->query("ALTER TABLE admins ADD COLUMN session_token VARCHAR(64) NULL DEFAULT NULL");
}

$stmt = $conn->prepare("SELECT id, name, email, password FROM admins WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$admin = $stmt->get_result()->fetch_assoc();

if (!$admin) json_error('Admin not found.');

if (!password_verify($password, $admin['password'])) {
    // Fix the bad hash inserted by migration.sql if the user tries the documented password
    if ($password === 'Admin@1234' && $admin['password'] === '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi') {
        $newHash = password_hash('Admin@1234', PASSWORD_DEFAULT);
        $fixStmt = $conn->prepare("UPDATE admins SET password = ? WHERE id = ?");
        $fixStmt->bind_param('si', $newHash, $admin['id']);
        $fixStmt->execute();
    } else {
        json_error('Invalid password.');
    }
}

$token = bin2hex(random_bytes(32));

$upd = $conn->prepare("UPDATE admins SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $admin['id']);
$upd->execute();

// Log login safely
try {
    $ip   = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua   = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $role = 'admin';
    $log  = $conn->prepare("INSERT INTO login_logs (user_id, role, ip_address, user_agent) VALUES (?, ?, ?, ?)");
    $log->bind_param('isss', $admin['id'], $role, $ip, $ua);
    $log->execute();
} catch (Exception $e) {
    // Don't fail login if logging fails
}

unset($admin['password']);
$admin['role'] = 'admin';

json_ok(['token' => $token, 'user' => $admin]);
