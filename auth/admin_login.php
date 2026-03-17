<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) json_error('Email and password are required.');

$stmt = $conn->prepare("SELECT id, name, email, password FROM admins WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$admin = $stmt->get_result()->fetch_assoc();

if (!$admin || !password_verify($password, $admin['password'])) {
    json_error('Invalid credentials.');
}

$token = bin2hex(random_bytes(32));
$upd   = $conn->prepare("UPDATE admins SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $admin['id']);
$upd->execute();

unset($admin['password']);
$admin['role'] = 'admin';

json_ok(['token' => $token, 'user' => $admin]);
