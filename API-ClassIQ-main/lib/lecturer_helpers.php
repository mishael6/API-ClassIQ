<?php
// api/lib/lecturer_helpers.php — schema + shared lecturer utilities

function lecturer_ensure_column(mysqli $conn, string $table, string $column, string $definition): void {
    $safe_table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safe_col   = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result     = $conn->query("SHOW COLUMNS FROM `{$safe_table}` LIKE '{$safe_col}'");
    if ($result && $result->num_rows === 0) {
        $conn->query("ALTER TABLE `{$safe_table}` ADD COLUMN {$definition}");
    }
}

function lecturer_table_has_column(mysqli $conn, string $table, string $column): bool {
    $safe_table = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $safe_col   = preg_replace('/[^a-zA-Z0-9_]/', '', $column);
    $result     = $conn->query("SHOW COLUMNS FROM `{$safe_table}` LIKE '{$safe_col}'");
    return $result && $result->num_rows > 0;
}

function lecturer_table_exists(mysqli $conn, string $table): bool {
    $safe = preg_replace('/[^a-zA-Z0-9_]/', '', $table);
    $r = $conn->query("SHOW TABLES LIKE '{$safe}'");
    return $r && $r->num_rows > 0;
}

function ensure_lecturer_schema(mysqli $conn): void {
    lecturer_ensure_column($conn, 'users', 'course', 'course VARCHAR(255) NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'students', 'lecturer_cohort_id', 'lecturer_cohort_id INT NULL DEFAULT NULL');

    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_semesters (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lecturer_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lecturer (lecturer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_weeks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        semester_id INT NOT NULL,
        week_number INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_semester_week (semester_id, week_number),
        INDEX idx_semester (semester_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Named student groups — DIT1A, BTech CS Level 100
    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_cohorts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        lecturer_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_lecturer_cohort (lecturer_id, name),
        INDEX idx_lecturer (lecturer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Teaching sessions per week: cohort + topic
    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        week_id INT NOT NULL,
        cohort_id INT NOT NULL,
        topic VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_week_cohort (week_id, cohort_id),
        INDEX idx_week (week_id),
        INDEX idx_cohort (cohort_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Migrate old lecturer_classes (week + class_number + topic) → cohorts + sessions
    if (lecturer_table_exists($conn, 'lecturer_classes') && lecturer_table_has_column($conn, 'lecturer_classes', 'week_id')) {
        $rows = $conn->query("
            SELECT lc.id, lc.week_id, lc.class_number, lc.topic,
                   w.week_number, w.semester_id, s.lecturer_id
            FROM lecturer_classes lc
            JOIN lecturer_weeks w ON w.id = lc.week_id
            JOIN lecturer_semesters s ON s.id = w.semester_id
        ");
        if ($rows) {
            $cohort_map = [];
            while ($row = $rows->fetch_assoc()) {
                $lid = (int)$row['lecturer_id'];
                $cn  = (int)$row['class_number'];
                $ckey = "{$lid}_{$cn}";
                if (!isset($cohort_map[$ckey])) {
                    $cname = "Class {$cn}";
                    $stmt = $conn->prepare("SELECT id FROM lecturer_cohorts WHERE lecturer_id = ? AND name = ? LIMIT 1");
                    $stmt->bind_param('is', $lid, $cname);
                    $stmt->execute();
                    $existing = $stmt->get_result()->fetch_assoc();
                    if ($existing) {
                        $cohort_map[$ckey] = (int)$existing['id'];
                    } else {
                        $ins = $conn->prepare("INSERT INTO lecturer_cohorts (lecturer_id, name) VALUES (?, ?)");
                        $ins->bind_param('is', $lid, $cname);
                        $ins->execute();
                        $cohort_map[$ckey] = $conn->insert_id;
                    }
                }
                $cohort_id = (int)$cohort_map[$ckey];
                $week_id   = (int)$row['week_id'];
                $topic     = $row['topic'];
                $sess = $conn->prepare("INSERT IGNORE INTO lecturer_sessions (week_id, cohort_id, topic) VALUES (?, ?, ?)");
                $sess->bind_param('iis', $week_id, $cohort_id, $topic);
                $sess->execute();
            }
        }
        @$conn->query("DROP TABLE lecturer_classes");
    }

    lecturer_ensure_column($conn, 'qr_sessions', 'lecturer_id', 'lecturer_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'week_number', 'week_number INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'session_id', 'session_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'cohort_id', 'cohort_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'semester_id', 'semester_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'class_name', 'class_name VARCHAR(255) NULL DEFAULT NULL');

    lecturer_ensure_column($conn, 'attendance', 'lecturer_id', 'lecturer_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'week_number', 'week_number INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'session_id', 'session_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'cohort_id', 'cohort_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'semester_id', 'semester_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'class_name', 'class_name VARCHAR(255) NULL DEFAULT NULL');

    // Legacy class_id on qr/attendance may point to old session rows — map session_id where possible
    if (lecturer_table_has_column($conn, 'qr_sessions', 'class_id') && !lecturer_table_has_column($conn, 'qr_sessions', 'session_id_migrated')) {
        @$conn->query("UPDATE qr_sessions SET session_id = class_id, cohort_id = class_id WHERE lecturer_id IS NOT NULL AND session_id IS NULL AND class_id IS NOT NULL");
        lecturer_ensure_column($conn, 'qr_sessions', 'session_id_migrated', 'session_id_migrated TINYINT NULL DEFAULT 1');
    }

    @$conn->query("ALTER TABLE qr_sessions MODIFY COLUMN classrep_id INT NULL DEFAULT NULL");
    @$conn->query("ALTER TABLE attendance MODIFY COLUMN classrep_id INT NULL DEFAULT NULL");
}

function lecturer_session_context(mysqli $conn, int $session_id, int $lecturer_id): ?array {
    $stmt = $conn->prepare("
        SELECT ls.id AS session_id, ls.topic,
               co.id AS cohort_id, co.name AS class_name,
               w.id AS week_id, w.week_number,
               s.id AS semester_id, s.name AS semester_name, s.lecturer_id
        FROM lecturer_sessions ls
        JOIN lecturer_cohorts co ON co.id = ls.cohort_id
        JOIN lecturer_weeks w ON w.id = ls.week_id
        JOIN lecturer_semesters s ON s.id = w.semester_id
        WHERE ls.id = ? AND s.lecturer_id = ?
        LIMIT 1
    ");
    $stmt->bind_param('ii', $session_id, $lecturer_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

function lecturer_cohort_context(mysqli $conn, int $cohort_id, int $lecturer_id): ?array {
    $stmt = $conn->prepare("SELECT id, lecturer_id, name FROM lecturer_cohorts WHERE id = ? AND lecturer_id = ? LIMIT 1");
    $stmt->bind_param('ii', $cohort_id, $lecturer_id);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc() ?: null;
}

function lecturer_schedule_tree(mysqli $conn, int $lecturer_id): array {
    $cohort_list = [];
    $cs = $conn->prepare("SELECT id, name, created_at FROM lecturer_cohorts WHERE lecturer_id = ? ORDER BY name ASC");
    $cs->bind_param('i', $lecturer_id);
    $cs->execute();
    $cohort_list = $cs->get_result()->fetch_all(MYSQLI_ASSOC);

    $semesters = [];
    $stmt = $conn->prepare("SELECT id, name, created_at FROM lecturer_semesters WHERE lecturer_id = ? ORDER BY created_at ASC, id ASC");
    $stmt->bind_param('i', $lecturer_id);
    $stmt->execute();

    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $sem) {
        $sem_id = (int)$sem['id'];
        $weeks  = [];
        $wk = $conn->prepare("SELECT id, week_number, created_at FROM lecturer_weeks WHERE semester_id = ? ORDER BY week_number ASC");
        $wk->bind_param('i', $sem_id);
        $wk->execute();
        foreach ($wk->get_result()->fetch_all(MYSQLI_ASSOC) as $week) {
            $week_id = (int)$week['id'];
            $ss = $conn->prepare("
                SELECT ls.id, ls.cohort_id, ls.topic, ls.created_at, co.name AS class_name
                FROM lecturer_sessions ls
                JOIN lecturer_cohorts co ON co.id = ls.cohort_id
                WHERE ls.week_id = ?
                ORDER BY co.name ASC
            ");
            $ss->bind_param('i', $week_id);
            $ss->execute();
            $sessions = $ss->get_result()->fetch_all(MYSQLI_ASSOC);
            $week['sessions'] = $sessions;
            $week['classes']  = $sessions;
            $weeks[] = $week;
        }
        $sem['weeks'] = $weeks;
        $semesters[]  = $sem;
    }

    return ['semesters' => $semesters, 'cohorts' => $cohort_list];
}

function lecturer_cohorts_with_students(mysqli $conn, int $lecturer_id): array {
    $base = student_frontend_url();
    $cohorts = [];
    $stmt = $conn->prepare("
        SELECT c.id, c.name, c.created_at,
               COUNT(s.id) AS student_count
        FROM lecturer_cohorts c
        LEFT JOIN students s ON s.lecturer_cohort_id = c.id AND s.user_id = ?
        WHERE c.lecturer_id = ?
        GROUP BY c.id
        ORDER BY c.name ASC
    ");
    $stmt->bind_param('ii', $lecturer_id, $lecturer_id);
    $stmt->execute();
    foreach ($stmt->get_result()->fetch_all(MYSQLI_ASSOC) as $row) {
        $cid = (int)$row['id'];
        $st = $conn->prepare("
            SELECT s.id, s.name, s.index_number, s.email, s.phone,
                   COUNT(a.id) AS present_count,
                   MAX(a.attendance_date) AS last_seen
            FROM students s
            LEFT JOIN attendance a ON a.student_id = s.id AND a.lecturer_id = ? AND a.deleted_at IS NULL
            WHERE s.user_id = ? AND s.lecturer_cohort_id = ?
            GROUP BY s.id
            ORDER BY s.name ASC
        ");
        $st->bind_param('iii', $lecturer_id, $lecturer_id, $cid);
        $st->execute();
        $row['students'] = $st->get_result()->fetch_all(MYSQLI_ASSOC);
        $row['registration_url'] = "{$base}/student/register?lecturer_id={$lecturer_id}&class_id={$cid}";
        $cohorts[] = $row;
    }
    return $cohorts;
}

function send_classiq_mail(string $to, string $subject, string $body): void {
    $from = getenv('CLASSIQ_MAIL_FROM') ?: 'classiq660@gmail.com';
    $headers = "From: ClassIQ <{$from}>\r\nReply-To: {$from}\r\nContent-Type: text/plain; charset=UTF-8";
    @mail($to, $subject, $body, $headers);
}

function normalize_user_role(array $user): array {
    $role = $user['role'] ?? '';
    if ($role === 'class_rep') $user['role'] = 'classrep';
    return $user;
}
