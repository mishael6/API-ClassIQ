<?php
// api/auth/login.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) json_error('Email and password are required.');

$stmt = $conn->prepare("SELECT id, name, email, password, status, role FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user) json_error('No user found with this email.');
if ($user['status'] !== 'approved') json_error('Your account is on hold. Wait for admin approval.');
if (!password_verify($password, $user['password'])) json_error('Invalid password.');

// Generate session token
$token = bin2hex(random_bytes(32));

// Update session token
$upd = $conn->prepare("UPDATE users SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $user['id']);
$upd->execute();

// Log login safely
try {
    $ip   = $_SERVER['REMOTE_ADDR'] ?? '';
    $ua   = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $role = 'classrep';
    $log  = $conn->prepare("INSERT INTO login_logs (user_id, role, ip_address, user_agent) VALUES (?, ?, ?, ?)");
    $log->bind_param('isss', $user['id'], $role, $ip, $ua);
    $log->execute();
} catch (Exception $e) {
    // Don't fail login if logging fails
}

unset($user['password']);
$user['role'] = 'classrep';

json_ok(['token' => $token, 'user' => $user]);