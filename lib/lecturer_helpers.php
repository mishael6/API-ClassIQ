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

function ensure_lecturer_schema(mysqli $conn): void {
    lecturer_ensure_column($conn, 'users', 'course', 'course VARCHAR(255) NULL DEFAULT NULL');

    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_semesters (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        lecturer_id  INT          NOT NULL,
        name         VARCHAR(255) NOT NULL,
        created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_lecturer (lecturer_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Migrate legacy flat lecturer_weeks (lecturer_id + week_number + topic) → hierarchy
    $legacy_weeks = $conn->query("SHOW TABLES LIKE 'lecturer_weeks'");
    if ($legacy_weeks && $legacy_weeks->num_rows > 0 && lecturer_table_has_column($conn, 'lecturer_weeks', 'topic')) {
        $conn->query("CREATE TABLE IF NOT EXISTS lecturer_weeks_new (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            semester_id  INT      NOT NULL,
            week_number  INT      NOT NULL,
            created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_semester_week (semester_id, week_number),
            INDEX idx_semester (semester_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $conn->query("CREATE TABLE IF NOT EXISTS lecturer_classes (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            week_id       INT          NOT NULL,
            class_number  INT          NOT NULL,
            topic         VARCHAR(255) NOT NULL,
            created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_week_class (week_id, class_number),
            INDEX idx_week (week_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $old = $conn->query("SELECT lecturer_id, week_number, topic FROM lecturer_weeks ORDER BY lecturer_id, week_number");
        if ($old) {
            $semester_map = [];
            $week_map     = [];
            while ($row = $old->fetch_assoc()) {
                $lid = (int)$row['lecturer_id'];
                if (!isset($semester_map[$lid])) {
                    $stmt = $conn->prepare("INSERT INTO lecturer_semesters (lecturer_id, name) VALUES (?, 'Semester 1')");
                    $stmt->bind_param('i', $lid);
                    $stmt->execute();
                    $semester_map[$lid] = $conn->insert_id;
                }
                $sem_id = (int)$semester_map[$lid];
                $wn     = (int)$row['week_number'];
                $key    = "{$sem_id}_{$wn}";

                if (!isset($week_map[$key])) {
                    $stmt = $conn->prepare("INSERT INTO lecturer_weeks_new (semester_id, week_number) VALUES (?, ?)");
                    $stmt->bind_param('ii', $sem_id, $wn);
                    $stmt->execute();
                    $week_map[$key] = $conn->insert_id;
                }

                $week_id = (int)$week_map[$key];
                $topic   = $row['topic'];
                $cnt = $conn->prepare("SELECT COUNT(*) AS c FROM lecturer_classes WHERE week_id = ?");
                $cnt->bind_param('i', $week_id);
                $cnt->execute();
                $cn = (int)$cnt->get_result()->fetch_assoc()['c'] + 1;

                $stmt = $conn->prepare("INSERT INTO lecturer_classes (week_id, class_number, topic) VALUES (?, ?, ?)");
                $stmt->bind_param('iis', $week_id, $cn, $topic);
                @$stmt->execute();
            }
        }

        @$conn->query("DROP TABLE lecturer_weeks");
        @$conn->query("RENAME TABLE lecturer_weeks_new TO lecturer_weeks");
    }

    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_weeks (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        semester_id  INT      NOT NULL,
        week_number  INT      NOT NULL,
        created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_semester_week (semester_id, week_number),
        INDEX idx_semester (semester_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $conn->query("CREATE TABLE IF NOT EXISTS lecturer_classes (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        week_id       INT          NOT NULL,
        class_number  INT          NOT NULL,
        topic         VARCHAR(255) NOT NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_week_class (week_id, class_number),
        INDEX idx_week (week_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    lecturer_ensure_column($conn, 'qr_sessions', 'lecturer_id', 'lecturer_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'week_number', 'week_number INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'class_id', 'class_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'semester_id', 'semester_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'qr_sessions', 'class_number', 'class_number INT NULL DEFAULT NULL');

    lecturer_ensure_column($conn, 'attendance', 'lecturer_id', 'lecturer_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'week_number', 'week_number INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'class_id', 'class_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'semester_id', 'semester_id INT NULL DEFAULT NULL');
    lecturer_ensure_column($conn, 'attendance', 'class_number', 'class_number INT NULL DEFAULT NULL');

    @$conn->query("ALTER TABLE qr_sessions MODIFY COLUMN classrep_id INT NULL DEFAULT NULL");
    @$conn->query("ALTER TABLE attendance MODIFY COLUMN classrep_id INT NULL DEFAULT NULL");
}

function lecturer_class_context(mysqli $conn, int $class_id, int $lecturer_id): ?array {
    $stmt = $conn->prepare("
        SELECT c.id AS class_id, c.class_number, c.topic,
               w.id AS week_id, w.week_number,
               s.id AS semester_id, s.name AS semester_name, s.lecturer_id
        FROM lecturer_classes c
        JOIN lecturer_weeks w ON w.id = c.week_id
        JOIN lecturer_semesters s ON s.id = w.semester_id
        WHERE c.id = ? AND s.lecturer_id = ?
        LIMIT 1
    ");
    $stmt->bind_param('ii', $class_id, $lecturer_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    return $row ?: null;
}

function lecturer_schedule_tree(mysqli $conn, int $lecturer_id): array {
    $semesters = [];
    $stmt = $conn->prepare("SELECT id, name, created_at FROM lecturer_semesters WHERE lecturer_id = ? ORDER BY created_at ASC, id ASC");
    $stmt->bind_param('i', $lecturer_id);
    $stmt->execute();
    $sem_rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

    foreach ($sem_rows as $sem) {
        $sem_id = (int)$sem['id'];
        $weeks  = [];

        $wk = $conn->prepare("SELECT id, week_number, created_at FROM lecturer_weeks WHERE semester_id = ? ORDER BY week_number ASC");
        $wk->bind_param('i', $sem_id);
        $wk->execute();
        foreach ($wk->get_result()->fetch_all(MYSQLI_ASSOC) as $week) {
            $week_id = (int)$week['id'];
            $cl = $conn->prepare("SELECT id, class_number, topic, created_at FROM lecturer_classes WHERE week_id = ? ORDER BY class_number ASC");
            $cl->bind_param('i', $week_id);
            $cl->execute();
            $week['classes'] = $cl->get_result()->fetch_all(MYSQLI_ASSOC);
            $weeks[] = $week;
        }

        $sem['weeks'] = $weeks;
        $semesters[]  = $sem;
    }

    return $semesters;
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
