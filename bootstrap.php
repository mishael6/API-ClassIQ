<?php
// api/bootstrap.php

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

date_default_timezone_set('Africa/Accra');

// ── CORS — works on all hosts ─────────────────────────────────
// Allow specific origins in production, or use * for development
$allowed_origins = [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'https://classiq.free.nf',        // your host (remove this line)
    'https://your-netlify-app.netlify.app', // replace with your Netlify URL
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? $_SERVER['HTTP_REFERER'] ?? '';
// Strip trailing slash from referer if present
$origin = rtrim(parse_url($origin, PHP_URL_SCHEME) . '://' . parse_url($origin, PHP_URL_HOST), '/');

if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Fallback: allow all (safe for development, tighten in production)
    header("Access-Control-Allow-Origin: *");
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ── DB ────────────────────────────────────────────────────────
require_once __DIR__ . '/db.php';
$conn->query("SET time_zone = '+00:00'");

// ── Auth helpers ──────────────────────────────────────────────
function get_bearer_token(): ?string {
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/', $h, $m)) return $m[1];
    return null;
}

function require_auth(mysqli $conn, string $role = 'classrep'): array {
    $token = get_bearer_token();
    if (!$token) json_error('Unauthorized', 401);

    $stmt = $conn->prepare("SELECT id, name, email, role FROM users WHERE session_token = ? LIMIT 1");
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

// ── Haversine ─────────────────────────────────────────────────
function haversine(float $lat1, float $lng1, float $lat2, float $lng2): float {
    $R    = 6371000;
    $dLat = deg2rad($lat2 - $lat1);
    $dLng = deg2rad($lng2 - $lng1);
    $a    = sin($dLat / 2) ** 2
          + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
    return $R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}
