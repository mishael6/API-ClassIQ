<?php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body     = get_body();
$email    = trim($body['email']    ?? '');
$password = trim($body['password'] ?? '');

if (!$email || !$password) json_error('Email and password are required.');

$stmt = $conn->prepare("SELECT id, name, email, password, status FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param('s', $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();

if (!$user)                                    json_error('No account found with this email.');
if (!password_verify($password, $user['password'])) json_error('Incorrect password.');
if ($user['status'] === 'pending')             json_error('Your account is pending admin approval.');
if ($user['status'] === 'rejected')            json_error('Your account has been rejected. Contact the administrator.');
if ($user['status'] !== 'approved')            json_error('Your account is not active.');

$token = bin2hex(random_bytes(32));
$upd   = $conn->prepare("UPDATE users SET session_token = ? WHERE id = ?");
$upd->bind_param('si', $token, $user['id']);
$upd->execute();

unset($user['password'], $user['status']);
$user['role'] = 'classrep'; // frontend role identifier

json_ok(['token' => $token, 'user' => $user]);