<?php
// api/ai/study.php
require_once __DIR__ . '/../bootstrap.php';
require_once __DIR__ . '/../lib/ai_helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$text       = trim($body['text']       ?? '');
$image_b64  = trim($body['image']      ?? '');
$img_mime   = trim($body['mime']       ?? 'image/jpeg');
$mode       = trim($body['mode']       ?? 'explain');
$student_id = (int)($body['student_id'] ?? 0);
$prompt_limit = ai_free_prompt_limit($conn);

if (!$text && !$image_b64) json_error('No text or image provided.');
if (!$student_id) json_error('Student ID required.');
if ($text && strlen($text) > 20000) json_error('Text too long. Please use a shorter document.');

$api_key = getenv('GROQ_API_KEY');
if (!$api_key) json_error('AI service not configured.');

$SIX_SYSTEM_TEACH = 'You are Six, a warm and knowledgeable AI study tutor for university students in Ghana. '
    . 'Your job is to help students truly understand — explain concepts clearly, step by step, with real examples. '
    . 'Write like a friendly senior student: encouraging, patient, and easy to follow. '
    . 'Use **bold** for section titles and key terms, bullet points for lists, and short paragraphs. '
    . 'Give proper explanations — not one-liners. The student may ask follow-up questions, so teach thoroughly.';

$SIX_SYSTEM_CHAT = 'You are Six, a warm AI study tutor for university students in Ghana. '
    . 'You are continuing an ongoing conversation. You remember everything discussed above. '
    . 'When the student asks a follow-up question, answer it directly — reference what you already explained, '
    . 'never tell them to paste material again, and never repeat the entire previous answer. '
    . 'Clarify, elaborate, give examples, or quiz them as requested. '
    . 'Use **bold** for key terms, bullets when helpful, and speak naturally.';

$SIX_RULES = "\n\nKeep your response well-structured and easy to read.\n";

$mode_prompts = [
    'explain' => "Teach the following study material to the student. Give a proper explanation they can learn from:\n\n"
        . "**Overview** — What is this topic about? (2-4 clear sentences)\n"
        . "**Core Concepts** — Explain each important idea in plain language (use bullet points)\n"
        . "**Worked Example** — Walk through one concrete example step by step\n"
        . "**Why It Matters** — How this connects to their course or real life\n"
        . "**Quick Check** — 2 short questions they can ask you if still confused\n"
        . "{$SIX_RULES}\n---\n",
    'mcq'     => "Create 5 multiple-choice questions from the material below to test understanding.\n\n"
        . "**Practice Quiz** 📝\n"
        . "For each question:\n1. [Clear question]?\n   A) ...  B) ...  C) ...  D) ...\n   ✅ Answer: [letter] — [one-line explanation why]\n\n"
        . "Make questions meaningful, not trivial.\n---\n",
    'flashcard' => "Create 8 flashcards from the material below for revision.\n\n"
        . "Format each pair exactly:\nQ: [clear question]\nA: [complete but concise answer]\n\n---\n",
    'fill'    => "Create 5 fill-in-the-blank questions from the material below.\n\n"
        . "Use ___ for each blank. After all questions write:\n**Answers** ✅\n1. answer\n...\n\n---\n",
];

$img_mode_prompts = [
    'explain'   => 'Read this image and teach the content properly. Use **Overview**, **Core Concepts** (bullets), **Worked Example**, and **Why It Matters**. Explain clearly so the student learns.',
    'mcq'       => 'Read this image and create 5 MCQs with A-D options. Add ✅ Answer and a brief why for each.',
    'flashcard' => 'Read this image and create 8 flashcards. Format: Q: ... A: ... only.',
    'fill'      => 'Read this image and create 5 fill-in-the-blank questions with ___ blanks, then **Answers** ✅ section.',
];

function six_parse_history(array $raw): array {
    $out = [];
    foreach (array_slice($raw, -12) as $m) {
        if (!is_array($m)) continue;
        $role = (($m['role'] ?? '') === 'assistant') ? 'assistant' : 'user';
        $content = trim((string)($m['content'] ?? ''));
        if ($content === '') continue;
        $out[] = ['role' => $role, 'content' => mb_substr($content, 0, 4000)];
    }
    return $out;
}

function six_mode_hint(string $mode): string {
    $hints = [
        'explain'   => 'Focus on clear teaching and understanding.',
        'mcq'       => 'If quizzing, base questions on the conversation so far.',
        'flashcard' => 'If making flashcards, use content from the conversation.',
        'fill'      => 'If fill-in-the-blank, use content from the conversation.',
    ];
    return $hints[$mode] ?? '';
}

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
        if ($used >= $prompt_limit) {
            json_error(ai_usage_limit_message($prompt_limit, $row['window_start']), 429);
        }
        $remaining = $prompt_limit - $used;
    }

    $history     = six_parse_history($body['history'] ?? []);
    $img_prompt  = $img_mode_prompts[$mode] ?? $img_mode_prompts['explain'];
    if ($history) {
        $ctx = "Conversation so far (use this context):\n";
        foreach (array_slice($history, -8) as $h) {
            $ctx .= strtoupper($h['role']) . ': ' . mb_substr($h['content'], 0, 600) . "\n";
        }
        $img_prompt = $ctx . "\n" . $img_prompt;
    }

    $payload = json_encode([
        'model'    => 'meta-llama/llama-4-scout-17b-16e-instruct',
        'messages' => [
            ['role' => 'system', 'content' => $SIX_SYSTEM_TEACH],
            ['role' => 'user', 'content' => [
                ['type' => 'text',      'text'      => $img_prompt],
                ['type' => 'image_url', 'image_url' => ['url' => "data:{$img_mime};base64,{$image_b64}"]],
            ]],
        ],
        'max_tokens'  => 1800,
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
        $remaining = max(0, $prompt_limit - ($row2['count'] ?? 0));
    }

    json_ok(['result' => $result, 'mode' => $mode, 'remaining' => $remaining ?? null, 'subscribed' => $has_subscription]);
}

// ── TEXT MODE (existing logic) ───────────────────────────────────────────────
if (!$text) json_error('No text provided.');
if (!isset($mode_prompts[$mode])) json_error('Invalid mode. Use: explain, mcq, flashcard, or fill.');

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
    if ($used >= $prompt_limit) {
        json_error(ai_usage_limit_message($prompt_limit, $row['window_start']), 429);
    }
    $remaining = $prompt_limit - $used;
}

// Build conversation messages
$history = six_parse_history($body['history'] ?? []);
$has_prior_ai = false;
foreach ($history as $h) {
    if ($h['role'] === 'assistant') { $has_prior_ai = true; break; }
}
// Follow-up: student already got an explanation and is asking a shorter question
$is_followup = $has_prior_ai && strlen($text) < 2000;

$messages = [];
if ($is_followup) {
    $messages[] = ['role' => 'system', 'content' => $SIX_SYSTEM_CHAT . ' ' . six_mode_hint($mode)];
    foreach ($history as $h) {
        $messages[] = $h;
    }
    $messages[] = ['role' => 'user', 'content' => $text];
} else {
    $prefix = $mode_prompts[$mode] ?? $mode_prompts['explain'];
    $messages[] = ['role' => 'system', 'content' => $SIX_SYSTEM_TEACH];
    foreach ($history as $h) {
        $messages[] = $h;
    }
    $messages[] = ['role' => 'user', 'content' => $prefix . $text];
}

$max_tokens = ($mode === 'explain' || $is_followup) ? 2000 : 1600;

$payload = json_encode([
    'model'       => 'llama-3.3-70b-versatile',
    'messages'    => $messages,
    'max_tokens'  => $max_tokens,
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
curl_setopt($ch, CURLOPT_TIMEOUT, 45);

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
    $remaining = max(0, $prompt_limit - ($row2['count'] ?? 0));
}

json_ok([
    'result'     => $result,
    'mode'       => $mode,
    'remaining'  => $remaining,
    'subscribed' => $has_subscription,
]);