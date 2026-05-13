<?php
// api/ai/study.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body = get_body();
$text       = trim($body['text']       ?? '');
$mode       = trim($body['mode']       ?? 'explain');
$student_id = (int)($body['student_id'] ?? 0);

if (!$text)       json_error('No text provided.');
if (!$student_id) json_error('Student ID required.');
if (strlen($text) > 20000) json_error('Text too long. Please use a shorter document.');

$api_key = getenv('GROQ_API_KEY');
if (!$api_key) json_error('AI service not configured.');

$today = date('Y-m-d');

// Check active subscription
$sub = $conn->prepare("SELECT id FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= ? LIMIT 1");
$sub->bind_param('is', $student_id, $today);
$sub->execute();
$has_subscription = $sub->get_result()->num_rows > 0;

if (!$has_subscription) {
    // Check daily usage
    $usage = $conn->prepare("SELECT count FROM ai_usage WHERE student_id = ? AND date = ?");
    $usage->bind_param('is', $student_id, $today);
    $usage->execute();
    $row = $usage->get_result()->fetch_assoc();
    $used = $row['count'] ?? 0;

    if ($used >= 10) {
        json_error('Daily limit reached. You have used all 10 free AI generations for today. Upgrade to unlimited for GH₵30/month.', 429);
    }
}

switch ($mode) {
    case 'explain':
        $prompt = "You are a friendly tutor helping a university student in Ghana. Explain the following learning material in simple, clear, layman terms. Use short paragraphs, bullet points where helpful, and real-life examples where possible. Avoid technical jargon.\n\n---\n$text";
        break;
    case 'mcq':
        $prompt = "Generate 5 multiple choice questions based on the following learning material. For each question provide 4 options (A, B, C, D) and clearly indicate the correct answer. Number each question.\n\n---\n$text";
        break;
    case 'flashcard':
        $prompt = "Create 8 flashcard pairs from the following learning material. Format each one exactly like this:\nQ: [question]\nA: [answer]\n\nMake the questions clear and concise.\n\n---\n$text";
        break;
    case 'fill':
        $prompt = "Create 5 fill-in-the-blank questions from the following learning material. Use ___ for the blank. After all questions, write 'ANSWERS:' and list the correct answers numbered.\n\n---\n$text";
        break;
    default:
        json_error('Invalid mode.');
}

$payload = json_encode([
    'model'    => 'llama-3.3-70b-versatile',
    'messages' => [
        ['role' => 'system', 'content' => 'You are a helpful study assistant for university students. Be clear, concise, and educational.'],
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

if (!$response) json_error('Failed to reach AI service. Try again.');

$data = json_decode($response, true);

if ($http_code !== 200) {
    $err = $data['error']['message'] ?? 'AI service error.';
    json_error($err);
}

$result = $data['choices'][0]['message']['content'] ?? '';
if (!$result) json_error('AI returned an empty response. Try again.');

// Update usage count (only for free tier)
if (!$has_subscription) {
    $upsert = $conn->prepare("INSERT INTO ai_usage (student_id, date, count) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE count = count + 1");
    $upsert->bind_param('is', $student_id, $today);
    $upsert->execute();
}

// Get remaining count
$remaining = null;
if (!$has_subscription) {
    $usage2 = $conn->prepare("SELECT count FROM ai_usage WHERE student_id = ? AND date = ?");
    $usage2->bind_param('is', $student_id, $today);
    $usage2->execute();
    $row2 = $usage2->get_result()->fetch_assoc();
    $remaining = 10 - ($row2['count'] ?? 0);
}

json_ok([
    'result'       => $result,
    'mode'         => $mode,
    'remaining'    => $remaining, // null means unlimited
    'subscribed'   => $has_subscription,
]);