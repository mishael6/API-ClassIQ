<?php
// api/ai/trivia_leaderboard.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') json_error('Method not allowed', 405);

$student_id = (int)($_GET['student_id'] ?? 0);
$limit      = min((int)($_GET['limit'] ?? 20), 50);

// Fetch global leaderboard
$stmt = $conn->prepare("
    SELECT 
        l.student_id,
        s.name,
        s.institution,
        s.program,
        s.level,
        l.total_points,
        l.total_sessions,
        RANK() OVER (ORDER BY l.total_points DESC) AS rank
    FROM trivia_leaderboard l
    JOIN students s ON s.id = l.student_id
    ORDER BY l.total_points DESC
    LIMIT ?
");
$stmt->bind_param('i', $limit);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);

// Get current student rank if provided
$my_rank = null;
$my_stats = null;

if ($student_id) {
    $me = $conn->prepare("
        SELECT 
            l.total_points,
            l.total_sessions,
            RANK() OVER (ORDER BY l.total_points DESC) AS rank
        FROM trivia_leaderboard l
        WHERE l.student_id = ?
        LIMIT 1
    ");
    $me->bind_param('i', $student_id);
    $me->execute();
    $my_stats = $me->get_result()->fetch_assoc();
    if ($my_stats) $my_rank = $my_stats['rank'];
}

json_ok([
    'leaderboard' => $rows,
    'my_stats'    => $my_stats,
    'my_rank'     => $my_rank,
]);