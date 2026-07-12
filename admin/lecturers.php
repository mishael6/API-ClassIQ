<?php
// api/admin/lecturers.php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/lecturer_helpers.php';
require_admin($conn);

ensure_lecturer_schema($conn);
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $search = $conn->real_escape_string($_GET['search'] ?? '');
    $status = $conn->real_escape_string($_GET['status'] ?? '');

    $where = "u.role = 'lecturer'";
    if ($search) $where .= " AND (u.name LIKE '%$search%' OR u.email LIKE '%$search%' OR u.course LIKE '%$search%')";
    if ($status) $where .= " AND u.status = '$status'";

    $rows = $conn->query("
        SELECT u.id, u.name, u.email, u.institution, u.course, u.status, u.created_at,
               COUNT(DISTINCT s.id) AS student_count,
               COUNT(DISTINCT w.id) AS week_count
        FROM users u
        LEFT JOIN students s ON s.user_id = u.id
        LEFT JOIN lecturer_weeks w ON w.lecturer_id = u.id
        WHERE $where
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ")->fetch_all(MYSQLI_ASSOC);

    json_ok(['lecturers' => $rows]);
}

if ($method === 'PUT') {
    $body   = get_body();
    $id     = (int)($body['id'] ?? 0);
    $action = trim($body['action'] ?? '');

    if (!$id) json_error('Lecturer ID required.');

    $chk = $conn->prepare("SELECT id FROM users WHERE id = ? AND role = 'lecturer' LIMIT 1");
    $chk->bind_param('i', $id);
    $chk->execute();
    if (!$chk->get_result()->fetch_assoc()) json_error('Lecturer not found.');

    if ($action === 'update') {
        $name        = $conn->real_escape_string(trim($body['name'] ?? ''));
        $email       = $conn->real_escape_string(trim($body['email'] ?? ''));
        $institution = $conn->real_escape_string(trim($body['institution'] ?? ''));
        $course      = $conn->real_escape_string(trim($body['course'] ?? ''));

        if (!$name || !$email || !$course) json_error('Name, email and course are required.');

        $dup = $conn->query("SELECT id FROM users WHERE email = '$email' AND id != $id LIMIT 1");
        if ($dup->num_rows > 0) json_error('This email is already used by another account.');

        $conn->query("UPDATE users SET name='$name', email='$email', institution='$institution', course='$course' WHERE id=$id");
        json_ok(['message' => 'Lecturer updated successfully.']);
    }

    if (!$action) json_error('Action required.');

    $status      = ($action === 'approve') ? 'approved' : 'rejected';
    $safe_status = $conn->real_escape_string($status);
    $conn->query("ALTER TABLE users MODIFY COLUMN status VARCHAR(30) DEFAULT 'pending'");
    $conn->query("UPDATE users SET status = '$safe_status' WHERE id = $id");

    $info = $conn->query("SELECT name, email, phone FROM users WHERE id = $id LIMIT 1");
    if ($info && $user = $info->fetch_assoc()) {
        if ($action === 'approve') {
            send_classiq_mail(
                $user['email'],
                'Your ClassIQ Lecturer Account Has Been Approved',
                "Dear {$user['name']},\n\nYour ClassIQ lecturer account has been approved!\n\nYou can now log in at the ClassIQ portal using the email and password you registered with.\n\n— ClassIQ Team\nclassiq660@gmail.com"
            );
            if (!empty($user['phone'])) {
                $msg = "Hello {$user['name']}, your ClassIQ lecturer account ({$user['email']}) has been approved! Log in with your registered password.";
                send_admin_sms($user['phone'], $msg);
            }
        } else {
            send_classiq_mail(
                $user['email'],
                'ClassIQ Application Update',
                "Dear {$user['name']},\n\nYour ClassIQ lecturer registration was not approved at this time.\n\n— ClassIQ Team"
            );
        }
    }

    json_ok(['message' => "Lecturer {$status} successfully.", 'status' => $status]);
}

if ($method === 'DELETE') {
    $id = (int)(get_body()['id'] ?? 0);
    if (!$id) json_error('Lecturer ID required.');

    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    $conn->query("DELETE FROM attendance WHERE lecturer_id = $id");
    $conn->query("DELETE FROM qr_sessions WHERE lecturer_id = $id");
    $conn->query("DELETE FROM lecturer_weeks WHERE lecturer_id = $id");
    $conn->query("DELETE FROM students WHERE user_id = $id");
    $conn->query("DELETE FROM troubleshooting_logs WHERE user_id = $id");
    $conn->query("DELETE FROM users WHERE id = $id AND role = 'lecturer'");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1");

    json_ok(['message' => 'Lecturer deleted successfully.']);
}

json_error('Method not allowed.', 405);
