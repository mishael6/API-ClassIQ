<?php
// api/admin/classreps.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET ───────────────────────────────────────────────────────
if ($method === 'GET') {
    $search = $conn->real_escape_string($_GET['search'] ?? '');
    $status = $conn->real_escape_string($_GET['status'] ?? '');

    $where = '1=1';
    if ($search) $where .= " AND (u.name LIKE '%$search%' OR u.email LIKE '%$search%')";
    if ($status) $where .= " AND u.status = '$status'";

    $rows = $conn->query("
        SELECT u.id, u.name, u.email, u.institution, u.department,
               u.program, u.status, u.created_at,
               COUNT(s.id) AS student_count
        FROM users u
        LEFT JOIN students s ON s.user_id = u.id
        WHERE $where
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ")->fetch_all(MYSQLI_ASSOC);

    json_ok(['classreps' => $rows]);
}

// ── PUT — approve, reject, or update ─────────────────────────
if ($method === 'PUT') {
    $body   = get_body();
    $id     = (int)($body['id']     ?? 0);
    $action = trim($body['action']  ?? '');

    if (!$id) json_error('Classrep ID required.');

    // ── Update classrep details ──
    if ($action === 'update') {
        $name        = $conn->real_escape_string(trim($body['name']        ?? ''));
        $email       = $conn->real_escape_string(trim($body['email']       ?? ''));
        $phone       = $conn->real_escape_string(trim($body['phone']       ?? ''));
        $institution = $conn->real_escape_string(trim($body['institution'] ?? ''));
        $department  = $conn->real_escape_string(trim($body['department']  ?? ''));
        $program     = $conn->real_escape_string(trim($body['program']     ?? ''));

        if (!$name || !$email) json_error('Name and email are required.');

        $chk = $conn->query("SELECT id FROM users WHERE email = '$email' AND id != $id LIMIT 1");
        if ($chk->num_rows > 0) json_error('This email is already used by another account.');

        $result = $conn->query("
            UPDATE users SET
                name        = '$name',
                email       = '$email',
                phone       = '$phone',
                institution = '$institution',
                department  = '$department',
                program     = '$program'
            WHERE id = $id
        ");

        if (!$result) json_error('Update failed: ' . $conn->error);
        json_ok(['message' => 'Classrep updated successfully.']);
    }

    // ── Approve or reject ──
    if (!$action) json_error('Action required.');
    $status     = ($action === 'approve') ? 'approved' : 'rejected';
    $safe_status = $conn->real_escape_string($status);

    // SILENT SCHEMA PATCH: Convert ENUM to VARCHAR to prevent Data Truncation
    $conn->query("ALTER TABLE users MODIFY COLUMN status VARCHAR(30) DEFAULT 'pending'");

    $result = $conn->query("UPDATE users SET status = '$safe_status' WHERE id = $id");
    if ($result === false) json_error('DB error: ' . $conn->error);

    $info = $conn->query("SELECT name, email FROM users WHERE id = $id LIMIT 1");
    if ($info && $user = $info->fetch_assoc()) {
        $body_text = $action === 'approve'
            ? "Dear {$user['name']},\n\nYour ClassIQ account has been approved!\n\n— ClassIQ Team"
            : "Dear {$user['name']},\n\nYour ClassIQ registration has been rejected.\n\n— ClassIQ Team";
        @mail($user['email'], 'ClassIQ Account Update', $body_text, "From: ClassIQ <noreply@classiq.app>");
    }

    json_ok(['message' => "Classrep {$status} successfully.", 'status' => $status]);
}

// ── DELETE ────────────────────────────────────────────────────
if ($method === 'DELETE') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);

    if (!$id) json_error('Classrep ID required.');

    $conn->query("SET FOREIGN_KEY_CHECKS = 0");

    $conn->query("DELETE FROM attendance           WHERE classrep_id = $id");
    $conn->query("DELETE FROM qr_sessions          WHERE classrep_id = $id");
    $conn->query("DELETE FROM students             WHERE user_id = $id");
    $conn->query("DELETE FROM troubleshooting_logs WHERE user_id = $id");
    $conn->query("DELETE FROM login_logs           WHERE user_id = $id");
    $conn->query("DELETE FROM users                WHERE id = $id");

    $conn->query("SET FOREIGN_KEY_CHECKS = 1");

    json_ok(['message' => 'Classrep deleted successfully.']);
}

json_error('Method not allowed.', 405);