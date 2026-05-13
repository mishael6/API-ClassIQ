<?php
// api/admin/ai_settings.php
require_once __DIR__ . '/../bootstrap.php';

$user = require_auth($conn);
if ($user['role'] !== 'admin') json_error('Admin access required.', 403);

// GET — fetch current settings and free grants
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $price = $conn->query("SELECT setting_value FROM ai_settings WHERE setting_key = 'subscription_price' LIMIT 1")->fetch_assoc();

    $grants = $conn->query("
        SELECT g.id, g.student_id, s.name, s.index_number, g.granted_at, g.expires_at, g.note
        FROM ai_free_grants g
        JOIN students s ON s.id = g.student_id
        ORDER BY g.granted_at DESC
    ")->fetch_all(MYSQLI_ASSOC);

    json_ok([
        'subscription_price' => $price['setting_value'] ?? '30.00',
        'free_grants'        => $grants,
    ]);
}

// POST — update price or manage grants
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body   = get_body();
    $action = trim($body['action'] ?? '');

    // Update subscription price
    if ($action === 'update_price') {
        $price = (float)($body['price'] ?? 0);
        if ($price <= 0) json_error('Price must be greater than 0.');

        $stmt = $conn->prepare("INSERT INTO ai_settings (setting_key, setting_value) VALUES ('subscription_price', ?) ON DUPLICATE KEY UPDATE setting_value = ?");
        $p    = number_format($price, 2, '.', '');
        $stmt->bind_param('ss', $p, $p);
        $stmt->execute();
        json_ok(['message' => "Subscription price updated to GH₵{$p}."]);
    }

    // Grant free unlimited to a student
    if ($action === 'grant_free') {
        $student_id = (int)($body['student_id'] ?? 0);
        $expires_at = trim($body['expires_at']  ?? ''); // null = forever
        $note       = trim($body['note']        ?? 'Granted by admin');
        $admin_id   = $user['id'];

        if (!$student_id) json_error('Student ID required.');

        $expires = $expires_at ?: null;
        $stmt    = $conn->prepare("
            INSERT INTO ai_free_grants (student_id, granted_by, expires_at, note)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE granted_by = ?, expires_at = ?, note = ?, granted_at = NOW()
        ");
        $stmt->bind_param('iississ', $student_id, $admin_id, $expires, $note, $admin_id, $expires, $note);
        $stmt->execute();
        json_ok(['message' => 'Free unlimited access granted to student.']);
    }

    // Revoke free grant
    if ($action === 'revoke_free') {
        $student_id = (int)($body['student_id'] ?? 0);
        if (!$student_id) json_error('Student ID required.');

        $stmt = $conn->prepare("DELETE FROM ai_free_grants WHERE student_id = ?");
        $stmt->bind_param('i', $student_id);
        $stmt->execute();
        json_ok(['message' => 'Free access revoked.']);
    }

    json_error('Invalid action.');
}

json_error('Method not allowed.', 405);