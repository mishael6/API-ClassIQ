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
    if ($status)  $where .= " AND u.status = '$status'";

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
    $action = $body['action'] ?? ''; // 'approve' | 'reject'

    if (!$id)     json_error('Classrep ID required.');
    if (!$action) json_error('Action required.');

    $status = $action === 'approve' ? 'approved' : 'rejected';

    $stmt = $conn->prepare("UPDATE users SET status = ? WHERE id = ?");
    $stmt->bind_param('si', $status, $id);
    $stmt->execute();

    if ($stmt->affected_rows === 0) json_error('Classrep not found.');

    // Send email notification
    $info = $conn->prepare("SELECT name, email FROM users WHERE id = ? LIMIT 1");
    $info->bind_param('i', $id);
    $info->execute();
    $user = $info->get_result()->fetch_assoc();

    if ($user) {
        $to      = $user['email'];
        $name    = $user['name'];
        $subject = $action === 'approve'
            ? 'ClassIQ — Your Account Has Been Approved'
            : 'ClassIQ — Account Registration Update';
        $body_text = $action === 'approve'
            ? "Dear $name,\n\nYour ClassIQ class representative account has been approved! You can now log in at: https://classiq.netlify.app/login\n\n— ClassIQ Team"
            : "Dear $name,\n\nUnfortunately your ClassIQ registration request has been rejected. Please contact your administrator for more information.\n\n— ClassIQ Team";
        $headers = "From: ClassIQ <noreply@classiq.app>\r\nContent-Type: text/plain; charset=UTF-8";
        @mail($to, $subject, $body_text, $headers);
    }

    json_ok(['message' => "Classrep $status successfully.", 'status' => $status]);
}

// ── DELETE — remove classrep ──────────────────────────────────
if ($method === 'DELETE') {
    $body = get_body();
    $id   = (int)($body['id'] ?? 0);

    if (!$id) json_error('Classrep ID required.');

    // Delete in order to respect foreign keys
    $conn->prepare("DELETE FROM attendance  WHERE classrep_id = ?")->execute() || true;
    $conn->prepare("DELETE FROM qr_sessions WHERE classrep_id = ?")->execute() || true;
    $conn->prepare("DELETE FROM students    WHERE user_id = ?")->execute()     || true;
    $conn->prepare("DELETE FROM troubleshooting_logs WHERE user_id = ?")->execute() || true;

    // Proper deletion with bound params
    foreach ([
        "DELETE FROM attendance            WHERE classrep_id = ?",
        "DELETE FROM qr_sessions           WHERE classrep_id = ?",
        "DELETE FROM students              WHERE user_id = ?",
        "DELETE FROM troubleshooting_logs  WHERE user_id = ?",
        "DELETE FROM login_logs            WHERE user_id = ?",
        "DELETE FROM users                 WHERE id = ?",
    ] as $sql) {
        $s = $conn->prepare($sql);
        $s->bind_param('i', $id);
        $s->execute();
    }

    json_ok(['message' => 'Classrep and all associated data deleted.']);
}

json_error('Method not allowed.', 405);