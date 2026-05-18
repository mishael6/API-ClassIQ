<?php
// api/app/download.php
// Public endpoint — no auth required.
// POST: records a new download from the landing page.
// GET:  returns the total download count (for admin dashboard).
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip         = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
    $user_agent = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255);

    $stmt = $conn->prepare("INSERT INTO app_downloads (ip_address, user_agent) VALUES (?, ?)");
    $stmt->bind_param('ss', $ip, $user_agent);
    $stmt->execute();

    $total = (int)$conn->query("SELECT COUNT(*) AS c FROM app_downloads")->fetch_assoc()['c'];
    json_ok(['total' => $total]);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $total = (int)$conn->query("SELECT COUNT(*) AS c FROM app_downloads")->fetch_assoc()['c'];
    json_ok(['total' => $total]);
}

json_error('Method not allowed', 405);
