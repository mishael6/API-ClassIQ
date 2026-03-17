<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) json_error('Email and password are required.');

$stmt = $conn->prepare("SELECT id, name, email, password FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user || !password_verify($password, $user['password'])) {
    json_error('Invalid email or password.');
}

// Generate session token
$token = bin2hex(random_bytes(32));
$conn->prepare("UPDATE users SET session_token = ? WHERE id = ?")->execute() || true;
$upd = $conn->prepare("UPDATE users SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $user['id']);
$upd->execute();

unset($user['password']);
$user['role'] = 'classrep';

json_ok([
    'token' => $token,
    'user'  => $user,
]);
