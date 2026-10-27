<?php
// api/ai/trivia_submit.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$student_id = (int)($body['student_id'] ?? 0);
$session_id = (int)($body['session_id'] ?? 0);
$answers    = $body['answers'] ?? [];
$score      = (int)($body['score'] ?? 0);

if (!$student_id) json_error('Student ID required.');
if (!$session_id) json_error('Session ID required.');
if (!is_array($answers)) json_error('Answers must be an array.');
if ($score < 0 || $score > 5) json_error('Invalid score.');

// Verify session belongs to student and is not already completed
$check = $conn->prepare("SELECT id, completed FROM trivia_sessions WHERE id = ? AND student_id = ? LIMIT 1");
$check->bind_param('ii', $session_id, $student_id);
$check->execute();
$session = $check->get_result()->fetch_assoc();

if (!$session) json_error('Trivia session not found.');
if ($session['completed']) json_error('This session has already been submitted.');

// Save answers and mark session complete
$answersJson = json_encode($answers);
$update = $conn->prepare("UPDATE trivia_sessions SET answers = ?, score = ?, completed = 1 WHERE id = ?");
$update->bind_param('sii', $answersJson, $score, $session_id);
$update->execute();

// Update leaderboard
$lb = $conn->prepare("
    INSERT INTO trivia_leaderboard (student_id, total_points, total_sessions)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE
        total_points   = total_points + VALUES(total_points),
        total_sessions = total_sessions + 1
");
$lb->bind_param('ii', $student_id, $score);
$lb->execute();

// Get updated rank
$rank_query = $conn->prepare("
    SELECT COUNT(*) + 1 AS `rank`
    FROM trivia_leaderboard
    WHERE total_points > (
        SELECT total_points FROM trivia_leaderboard WHERE student_id = ?
    )
");
$rank_query->bind_param('i', $student_id);
$rank_query->execute();
$rank = $rank_query->get_result()->fetch_assoc()['rank'];

// Get updated total points
$pts = $conn->prepare("SELECT total_points, total_sessions FROM trivia_leaderboard WHERE student_id = ? LIMIT 1");
$pts->bind_param('i', $student_id);
$pts->execute();
$totals = $pts->get_result()->fetch_assoc();

json_ok([
    'score'          => $score,
    'total'          => 5,
    'total_points'   => $totals['total_points'],
    'total_sessions' => $totals['total_sessions'],
    'rank'           => $rank,
]);