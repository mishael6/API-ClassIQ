<?php
// api/ai/trivia_reset.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$conn->query("TRUNCATE TABLE trivia_leaderboard");

json_ok(['message' => 'Trivia leaderboard has been reset.']);
