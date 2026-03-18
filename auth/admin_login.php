<?php
// api/auth/admin_login.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) json_error('Email and password are required.');

$stmt = $conn->prepare("SELECT id, name, email, password, role FROM admins WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$admin = $stmt->get_result()->fetch_assoc();

if (!$admin) json_error('Admin not found.');
if (!password_verify($password, $admin['password'])) json_error('Invalid password.');

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
