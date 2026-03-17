<?php
require_once __DIR__ . '/../bootstrap.php';

$token = get_bearer_token();
if ($token) {
    $stmt = $conn->prepare("UPDATE users SET session_token = NULL WHERE session_token = ?");
    $stmt->bind_param('s', $token);
    $stmt->execute();

    $stmt2 = $conn->prepare("UPDATE admins SET session_token = NULL WHERE session_token = ?");
    $stmt2->bind_param('s', $token);
    $stmt2->execute();
}

json_ok(['message' => 'Logged out.']);
