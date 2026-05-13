<?php
// api/ai/study.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$text       = trim($body['text']       ?? '');
$mode       = trim($body['mode']       ?? 'explain');
$student_id = (int)($body['student_id'] ?? 0);

if (!$text)       json_error('No text provided.');
if (!$student_id) json_error('Student ID required.');
if (strlen($text) > 20000) json_error('Text too long. Please use a shorter document.');

$api_key = getenv('GROQ_API_KEY');
if (!$api_key) json_error('AI service not configured.');

$now = date('Y-m-d H:i:s');

// 1. Check active paid subscription
$sub = $conn->prepare("SELECT id FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= CURDATE() LIMIT 1");
$sub->bind_param('i', $student_id);
$sub->execute();
$has_subscription = $sub->get_result()->num_rows > 0;

// 2. Check free grant by admin
if (!$has_subscription) {
    $grant = $conn->prepare("SELECT id FROM ai_free_grants WHERE student_id = ? AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1");
    $grant->bind_param('i', $student_id);
    $grant->execute();
    $has_free_grant = $grant->get_result()->num_rows > 0;
    if ($has_free_grant) $has_subscription = true;
}

// 3. Check 2hr window usage for free users
$is_limited = false;
$remaining  = null;
$reset_in   = null;

if (!$has_subscription) {
    $window_start = date('Y-m-d H:i:s', strtotime('-2 hours'));

    $usage = $conn->prepare("SELECT count, window_start FROM ai_usage WHERE student_id = ? AND window_start >= ? ORDER BY window_start DESC LIMIT 1");
    $usage->bind_param('is', $student_id, $window_start);
    $usage->execute();
    $row = $usage->get_result()->fetch_assoc();
    $used = $row['count'] ?? 0;

    if ($used >= 10) {
        // Calculate reset time
        $reset_time = date('Y-m-d H:i:s', strtotime($row['window_start']) + 7200);
        $diff       = strtotime($reset_time) - time();
        $mins       = ceil($diff / 60);
        json_error("You've used all 10 prompts for this 2-hour window. Resets in {$mins} minute(s). Upgrade Six for unlimited access!", 429);
    }

    $remaining = 10 - $used;
}

// Build prompt
switch ($mode) {
    case 'explain':
        $prompt = "You are Six, a friendly and smart AI study assistant helping university students in Ghana. Explain the following learning material in simple, clear, layman terms. Use short paragraphs and bullet points where helpful. Be encouraging and use relatable examples.\n\n---\n$text";
        break;
    case 'mcq':
        $prompt = "You are Six, an AI study assistant. Generate 5 multiple choice questions based on the following material. For each question provide 4 options (A, B, C, D) and indicate the correct answer clearly. Number each question.\n\n---\n$text";
        break;
    case 'flashcard':
        $prompt = "You are Six, an AI study assistant. Create 8 flashcard pairs from the following material. Format each one exactly like this:\nQ: [question]\nA: [answer]\n\nMake questions clear and concise.\n\n---\n$text";
        break;
    case 'fill':
        $prompt = "You are Six, an AI study assistant. Create 5 fill-in-the-blank questions from the following material. Use ___ for the blank. After all questions write 'ANSWERS:' and list the correct answers numbered.\n\n---\n$text";
        break;
    default:
        json_error('Invalid mode. Use: explain, mcq, flashcard, or fill.');
}

$payload = json_encode([
    'model'    => 'llama-3.3-70b-versatile',
    'messages' => [
        ['role' => 'system', 'content' => 'You are Six, a helpful and friendly AI study assistant for university students in Ghana. Be clear, encouraging, and educational.'],
        ['role' => 'user',   'content' => $prompt],
    ],
    'max_tokens'  => 1500,
    'temperature' => 0.7,
]);

$ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    "Authorization: Bearer $api_key",
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$response) json_error('Six is unavailable right now. Try again shortly.');

$data = json_decode($response, true);

if ($http_code !== 200) {
    $err = $data['error']['message'] ?? 'AI service error.';
    json_error($err);
}

$result = $data['choices'][0]['message']['content'] ?? '';
if (!$result) json_error('Six returned an empty response. Try again.');

// Update usage for free users
if (!$has_subscription) {
    $upsert = $conn->prepare("
        INSERT INTO ai_usage (student_id, date, count, window_start)
        VALUES (?, CURDATE(), 1, ?)
        ON DUPLICATE KEY UPDATE count = count + 1
    ");
    $upsert->bind_param('is', $student_id, $now);
    $upsert->execute();

    // Recalculate remaining
    $window_start2 = date('Y-m-d H:i:s', strtotime('-2 hours'));
    $u2 = $conn->prepare("SELECT count FROM ai_usage WHERE student_id = ? AND window_start >= ? ORDER BY window_start DESC LIMIT 1");
    $u2->bind_param('is', $student_id, $window_start2);
    $u2->execute();
    $row2     = $u2->get_result()->fetch_assoc();
    $remaining = max(0, 10 - ($row2['count'] ?? 0));
}

json_ok([
    'result'     => $result,
    'mode'       => $mode,
    'remaining'  => $remaining,
    'subscribed' => $has_subscription,
]);