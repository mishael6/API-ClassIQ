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

// ── PUT — approve or reject ───────────────────────────────────
if ($method === 'PUT') {
    $body   = get_body();
    $id     = (int)($body['id']     ?? 0);
    $action = trim($body['action']  ?? '');

    if (!$id)     json_error('Classrep ID required.');
    if (!$action) json_error('Action required.');

    $status = ($action === 'approve') ? 'approved' : 'rejected';

    // Use direct query to avoid any prepared statement issues
    $safe_id     = (int)$id;
    $safe_status = $conn->real_escape_string($status);

    $result = $conn->query("UPDATE users SET status = '$safe_status' WHERE id = $safe_id");

    if ($result === false) {
        json_error('DB error: ' . $conn->error);
    }

    // Send email (non-blocking)
    $info = $conn->query("SELECT name, email FROM users WHERE id = $safe_id LIMIT 1");
    if ($info && $user = $info->fetch_assoc()) {
        $to        = $user['email'];
        $name      = $user['name'];
        $subject   = $action === 'approve'
            ? 'ClassIQ — Your Account Has Been Approved'
            : 'ClassIQ — Account Registration Update';
        $body_text = $action === 'approve'
            ? "Dear $name,\n\nYour ClassIQ account has been approved! You can now log in.\n\n— ClassIQ Team"
            : "Dear $name,\n\nYour ClassIQ registration has been rejected.\n\n— ClassIQ Team";
        @mail($to, $subject, $body_text, "From: ClassIQ <noreply@classiq.app>");
    }

    json_ok([
        'message' => "Classrep {$status} successfully.",
        'status'  => $status,
    ]);
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