<?php
// api/admin/classreps.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

$method = $_SERVER['REQUEST_METHOD'];

// ── GET — list classreps ──────────────────────────────────────
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
    $action = $body['action'] ?? '';

    if (!$id)     json_error('Classrep ID required.');
    if (!$action) json_error('Action required.');

    $status = $action === 'approve' ? 'approved' : 'rejected';

    // Verify user exists first
    $exists = $conn->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
    $exists->bind_param('i', $id);
    $exists->execute();
    if ($exists->get_result()->num_rows === 0) json_error('Classrep not found.');

    $stmt = $conn->prepare("UPDATE users SET status = ? WHERE id = ?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();
    // Send email notification
    $info = $conn->prepare("SELECT name, email FROM users WHERE id = ? LIMIT 1");
    $info->bind_param('i', $id);
    $info->execute();
    $user = $info->get_result()->fetch_assoc();

    if ($user) {
        $to        = $user['email'];
        $name      = $user['name'];
        $subject   = $action === 'approve'
            ? 'ClassIQ — Your Account Has Been Approved'
            : 'ClassIQ — Account Registration Update';
        $body_text = $action === 'approve'
            ? "Dear $name,\n\nYour ClassIQ class representative account has been approved! You can now log in.\n\n— ClassIQ Team"
            : "Dear $name,\n\nYour ClassIQ registration request has been rejected. Please contact your administrator.\n\n— ClassIQ Team";
        $headers = "From: ClassIQ <noreply@classiq.app>\r\nContent-Type: text/plain; charset=UTF-8";
        @mail($to, $subject, $body_text, $headers);
    }

    json_ok(['message' => "Classrep {$status} successfully.", 'status' => $status]);
}

// ── DELETE — remove classrep ──────────────────────────────────
if ($method === 'DELETE') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);

    if (!$id) json_error('Classrep ID required.');

    // Verify classrep exists first
    $chk = $conn->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
    $chk->bind_param('i', $id);
    $chk->execute();
    if ($chk->get_result()->num_rows === 0) json_error('Classrep not found.');

    // Disable foreign key checks for clean deletion
    $conn->query("SET FOREIGN_KEY_CHECKS = 0");

    // Delete all related data
    $tables = [
        "DELETE FROM attendance           WHERE classrep_id = ?",
        "DELETE FROM qr_sessions          WHERE classrep_id = ?",
        "DELETE FROM students             WHERE user_id = ?",
        "DELETE FROM troubleshooting_logs WHERE user_id = ?",
        "DELETE FROM login_logs           WHERE user_id = ?",
        "DELETE FROM users                WHERE id = ?",
    ];

    foreach ($tables as $sql) {
        $s = $conn->prepare($sql);
        if ($s) {
            $s->bind_param('i', $id);
            $s->execute();
            $s->close();
        }
    }

    // Re-enable foreign key checks
    $conn->query("SET FOREIGN_KEY_CHECKS = 1");

    json_ok(['message' => 'Classrep and all associated data deleted.']);
}

json_error('Method not allowed.', 405);