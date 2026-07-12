<?php
// api/ai/ai_settings.php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/ai_helpers.php';

$user = require_auth($conn);
if ($user['role'] !== 'admin') json_error('Admin access required.', 403);

// GET — fetch current settings and free grants
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $price = ai_get_setting($conn, 'subscription_price', '30.00');
    $prompt_limit = ai_free_prompt_limit($conn);

    $grants = $conn->query("
        SELECT g.id, g.student_id, s.name, s.index_number, g.granted_at, g.expires_at, g.note
        FROM ai_free_grants g
        JOIN students s ON s.id = g.student_id
        ORDER BY g.granted_at DESC
    ")->fetch_all(MYSQLI_ASSOC);

    json_ok([
        'subscription_price' => $price,
        'free_prompt_limit'  => $prompt_limit,
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

        $p = number_format($price, 2, '.', '');
        ai_set_setting($conn, 'subscription_price', $p);
        json_ok(['message' => "Subscription price updated to GH₵{$p}."]);
    }

    // Update free prompt limit per 2-hour window
    if ($action === 'update_prompt_limit') {
        $limit = (int)($body['limit'] ?? 0);
        if ($limit < 1 || $limit > 999) json_error('Prompt limit must be between 1 and 999.');

        ai_set_setting($conn, 'free_prompt_limit', (string)$limit);
        json_ok(['message' => "Free prompt limit updated to {$limit} per 2-hour window.", 'free_prompt_limit' => $limit]);
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