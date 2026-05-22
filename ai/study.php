<?php
// api/ai/study.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$text       = trim($body['text']       ?? '');
$image_b64  = trim($body['image']      ?? '');
$img_mime   = trim($body['mime']       ?? 'image/jpeg');
$mode       = trim($body['mode']       ?? 'explain');
$student_id = (int)($body['student_id'] ?? 0);

if (!$text && !$image_b64) json_error('No text or image provided.');
if (!$student_id) json_error('Student ID required.');
if ($text && strlen($text) > 20000) json_error('Text too long. Please use a shorter document.');

$api_key = getenv('GROQ_API_KEY');
if (!$api_key) json_error('AI service not configured.');

$now = date('Y-m-d H:i:s');

// ── IMAGE MODE (vision) ──────────────────────────────────────────────────────
if ($image_b64) {
    // Validate basic base64
    if (!preg_match('/^[A-Za-z0-9+\/=]+$/', substr($image_b64, 0, 100))) {
        json_error('Invalid image data.');
    }

    // Check subscription / usage (same as text)
    $sub = $conn->prepare("SELECT id FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= CURDATE() LIMIT 1");
    $sub->bind_param('i', $student_id);
    $sub->execute();
    $has_subscription = $sub->get_result()->num_rows > 0;
    if (!$has_subscription) {
        $grant = $conn->prepare("SELECT id FROM ai_free_grants WHERE student_id = ? AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1");
        $grant->bind_param('i', $student_id);
        $grant->execute();
        if ($grant->get_result()->num_rows > 0) $has_subscription = true;
    }
    if (!$has_subscription) {
        $window_start = date('Y-m-d H:i:s', strtotime('-2 hours'));
        $usage = $conn->prepare("SELECT count, window_start FROM ai_usage WHERE student_id = ? AND window_start >= ? ORDER BY window_start DESC LIMIT 1");
        $usage->bind_param('is', $student_id, $window_start);
        $usage->execute();
        $row  = $usage->get_result()->fetch_assoc();
        $used = $row['count'] ?? 0;
        if ($used >= 10) {
            $diff = strtotime($row['window_start']) + 7200 - time();
            json_error('You\'ve used all 10 prompts for this window. Resets in ' . ceil($diff/60) . ' min(s). Upgrade Six!', 429);
        }
        $remaining = 10 - $used;
    }

    // Build vision prompt per mode
    $img_prompts = [
        'explain'   => 'Extract all readable text from this image, then explain the content in simple, clear terms for a university student. Use bullet points and short paragraphs. Be encouraging.',
        'mcq'       => 'Extract the text from this image then generate 5 multiple choice questions (A, B, C, D) based on the content. Clearly mark the correct answer for each.',
        'flashcard' => 'Extract the text from this image then create 8 flashcard pairs. Format each as:\nQ: [question]\nA: [answer]',
        'fill'      => 'Extract the text from this image then create 5 fill-in-the-blank questions using ___ for blanks. After all questions write ANSWERS: and list the correct answers.',
    ];
    $img_prompt = $img_prompts[$mode] ?? $img_prompts['explain'];

    $payload = json_encode([
        'model'    => 'meta-llama/llama-4-scout-17b-16e-instruct',
        'messages' => [[
            'role'    => 'user',
            'content' => [
                ['type' => 'text',      'text'      => 'You are Six, a helpful AI study assistant for university students in Ghana. ' . $img_prompt],
                ['type' => 'image_url', 'image_url' => ['url' => "data:{$img_mime};base64,{$image_b64}"]],
            ],
        ]],
        'max_tokens'  => 1500,
        'temperature' => 0.7,
    ]);

    $ch = curl_init('https://api.groq.com/openai/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', "Authorization: Bearer $api_key"]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 45);
    $response  = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (!$response) json_error('Six vision is unavailable right now. Try again.');
    $data = json_decode($response, true);
    if ($http_code !== 200) json_error($data['error']['message'] ?? 'Vision AI error.');
    $result = $data['choices'][0]['message']['content'] ?? '';
    if (!$result) json_error('Six could not read the image. Try a clearer photo.');

    // Update usage for free users
    if (!$has_subscription) {
        $upsert = $conn->prepare("INSERT INTO ai_usage (student_id, date, count, window_start) VALUES (?, CURDATE(), 1, ?) ON DUPLICATE KEY UPDATE count = count + 1");
        $upsert->bind_param('is', $student_id, $now);
        $upsert->execute();
        $window_start2 = date('Y-m-d H:i:s', strtotime('-2 hours'));
        $u2 = $conn->prepare("SELECT count FROM ai_usage WHERE student_id = ? AND window_start >= ? ORDER BY window_start DESC LIMIT 1");
        $u2->bind_param('is', $student_id, $window_start2);
        $u2->execute();
        $row2      = $u2->get_result()->fetch_assoc();
        $remaining = max(0, 10 - ($row2['count'] ?? 0));
    }

    json_ok(['result' => $result, 'mode' => $mode, 'remaining' => $remaining ?? null, 'subscribed' => $has_subscription]);
}

// ── TEXT MODE (existing logic) ───────────────────────────────────────────────
if (!$text) json_error('No text provided.');

// 1. Check subscription
$sub = $conn->prepare("SELECT id FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= CURDATE() LIMIT 1");
$sub->bind_param('i', $student_id);
$sub->execute();
$has_subscription = $sub->get_result()->num_rows > 0;

// 2. Check free grant
if (!$has_subscription) {
    $grant = $conn->prepare("SELECT id FROM ai_free_grants WHERE student_id = ? AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1");
    $grant->bind_param('i', $student_id);
    $grant->execute();
    if ($grant->get_result()->num_rows > 0) $has_subscription = true;
}

// 3. Check 2hr window usage
$remaining = null;
if (!$has_subscription) {
    $window_start = date('Y-m-d H:i:s', strtotime('-2 hours'));
    $usage = $conn->prepare("SELECT count, window_start FROM ai_usage WHERE student_id = ? AND window_start >= ? ORDER BY window_start DESC LIMIT 1");
    $usage->bind_param('is', $student_id, $window_start);
    $usage->execute();
    $row  = $usage->get_result()->fetch_assoc();
    $used = $row['count'] ?? 0;
    if ($used >= 10) {
        $diff = strtotime($row['window_start']) + 7200 - time();
        json_error("You've used all 10 prompts for this 2-hour window. Resets in " . ceil($diff/60) . " minute(s). Upgrade Six for unlimited access!", 429);
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