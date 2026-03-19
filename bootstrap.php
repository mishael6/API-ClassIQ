<?php
// api/bootstrap.php

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

date_default_timezone_set('Africa/Accra');

// ── Always return JSON even on fatal errors ───────────────────
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json');
        }
        echo json_encode([
            'success' => false,
            'message' => 'Server error: ' . $err['message'] . ' in ' . basename($err['file']) . ' line ' . $err['line']
        ]);
    }
});

// ── CORS ──────────────────────────────────────────────────────
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ── DB ────────────────────────────────────────────────────────
require_once __DIR__ . '/db.php';
$conn->query("SET time_zone = '+00:00'");

// ── Auth helpers ──────────────────────────────────────────────
function get_bearer_token(): ?string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/', $h, $m)) return $m[1];
    return null;
}

function require_auth(mysqli $conn): array {
    $token = get_bearer_token();
    if (!$token) json_error('Unauthorized', 401);

    // role can be 'class_rep' in DB
    $stmt = $conn->prepare("SELECT id, name, email, role FROM users WHERE session_token = ? AND status = 'approved' LIMIT 1");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) json_error('Unauthorized', 401);
    return $row;
}

function require_admin(mysqli $conn): array {
    $token = get_bearer_token();
    if (!$token) json_error('Unauthorized', 401);

    $stmt = $conn->prepare("SELECT id, name, email FROM admins WHERE session_token = ? LIMIT 1");
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) json_error('Unauthorized', 401);
    return $row;
}

// ── Response helpers ──────────────────────────────────────────
function json_ok(array $data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

function json_error(string $message, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message]);
    exit;
}

function get_body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float {
    $R    = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a    = sin($dLat/2)**2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng/2)**2;
    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}
