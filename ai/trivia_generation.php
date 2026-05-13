<?php
// api/ai/trivia_generate.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$student_id = (int)($body['student_id'] ?? 0);
$courses    = trim($body['courses'] ?? '');

if (!$student_id) json_error('Student ID required.');
if (!$courses)    json_error('Courses are required.');

$api_key = getenv('GROQ_API_KEY');
if (!$api_key) json_error('AI service not configured.');

// Check subscription or free grant
$sub = $conn->prepare("SELECT id FROM ai_subscriptions WHERE student_id = ? AND status = 'active' AND end_date >= CURDATE() LIMIT 1");
$sub->bind_param('i', $student_id);
$sub->execute();
$has_subscription = $sub->get_result()->num_rows > 0;

if (!$has_subscription) {
    $grant = $conn->prepare("SELECT id FROM ai_free_grants WHERE student_id = ? AND (expires_at IS NULL OR expires_at >= CURDATE()) LIMIT 1");
    $grant->bind_param('i', $student_id);
    $grant->execute();
    $has_free_grant = $grant->get_result()->num_rows > 0;
    if ($has_free_grant) $has_subscription = true;
}

if (!$has_subscription) {
    $window_start = date('Y-m-d H:i:s', strtotime('-2 hours'));
    $usage = $conn->prepare("SELECT count, window_start FROM ai_usage WHERE student_id = ? AND window_start >= ? ORDER BY window_start DESC LIMIT 1");
    $usage->bind_param('is', $student_id, $window_start);
    $usage->execute();
    $row  = $usage->get_result()->fetch_assoc();
    $used = $row['count'] ?? 0;

    if ($used >= 10) {
        $reset_time = date('Y-m-d H:i:s', strtotime($row['window_start']) + 7200);
        $diff       = strtotime($reset_time) - time();
        $mins       = ceil($diff / 60);
        json_error("You've used all 10 prompts for this 2-hour window. Resets in {$mins} minute(s). Upgrade Six for unlimited access!", 429);
    }
}

// Fetch student info for context
$stu = $conn->prepare("SELECT name, program, department, level, institution FROM students WHERE id = ? LIMIT 1");
$stu->bind_param('i', $student_id);
$stu->execute();
$student = $stu->get_result()->fetch_assoc();
if (!$student) json_error('Student not found.');

$prompt = "You are Six, a smart AI study assistant for university students in Ghana.

Generate exactly 5 trivia questions for a student with the following profile:
- Institution: {$student['institution']}
- Program: {$student['program']}
- Department: {$student['department']}
- Level: {$student['level']}
- Courses: {$courses}

Mix the question types: include Multiple Choice (MCQ), True/False, and Fill in the Blank questions.

Return ONLY a valid JSON array. No explanation, no markdown, no extra text. Just the raw JSON array.

Format:
[
  {
    \"type\": \"mcq\",
    \"question\": \"What is ...\",
    \"options\": [\"A. ...\", \"B. ...\", \"C. ...\", \"D. ...\"],
    \"answer\": \"A. ...\"
  },
  {
    \"type\": \"truefalse\",
    \"question\": \"True or False: ...\",
    \"options\": [\"True\", \"False\"],
    \"answer\": \"True\"
  },
  {
    \"type\": \"fillintheblank\",
    \"question\": \"The ___ is responsible for ...\",
    \"options\": [],
    \"answer\": \"correct word\"
  }
]";

$payload = json_encode([
    'model'    => 'llama-3.3-70b-versatile',
    'messages' => [
        ['role' => 'system', 'content' => 'You are Six, a helpful AI study assistant. Always return only valid raw JSON when asked. No markdown, no explanation.'],
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

$raw = $data['choices'][0]['message']['content'] ?? '';
if (!$raw) json_error('Six returned an empty response. Try again.');

// Strip markdown fences if present
$raw = preg_replace('/^```json\s*/i', '', trim($raw));
$raw = preg_replace('/```$/', '', trim($raw));

$questions = json_decode($raw, true);
if (!$questions || !is_array($questions)) json_error('Six could not generate questions. Try again.');

// Save session to DB
$now  = date('Y-m-d H:i:s');
$stmt = $conn->prepare("INSERT INTO trivia_sessions (student_id, courses, questions, created_at) VALUES (?, ?, ?, ?)");
$questionsJson = json_encode($questions);
$stmt->bind_param('isss', $student_id, $courses, $questionsJson, $now);
$stmt->execute();
$session_id = $conn->insert_id;

// Track usage for free users
if (!$has_subscription) {
    $upsert = $conn->prepare("
        INSERT INTO ai_usage (student_id, date, count, window_start)
        VALUES (?, CURDATE(), 1, ?)
        ON DUPLICATE KEY UPDATE count = count + 1
    ");
    $upsert->bind_param('is', $student_id, $now);
    $upsert->execute();
}

json_ok([
    'session_id' => $session_id,
    'questions'  => $questions,
    'total'      => count($questions),
]);