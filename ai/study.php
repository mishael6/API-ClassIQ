<?php
// api/ai/study.php
require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body   = get_body();
$text   = trim($body['text']   ?? '');
$mode   = trim($body['mode']   ?? 'explain');

if (!$text) json_error('No text provided.');
if (strlen($text) > 20000) json_error('Text too long. Please upload a shorter document.');

$api_key = getenv('GEMINI_API_KEY');
if (!$api_key) json_error('AI service not configured.');

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
        json_error('Invalid mode. Use: explain, mcq, flashcard, or fill.');
}

$payload = json_encode([
    'contents' => [
        ['parts' => [['text' => $prompt]]]
    ],
    'generationConfig' => [
        'temperature'     => 0.7,
        'maxOutputTokens' => 1500,
    ]
]);

$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$api_key";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$response) json_error('Failed to reach AI service. Try again.');

$data = json_decode($response, true);

if ($http_code !== 200) {
    $err = $data['error']['message'] ?? 'AI service error.';
    json_error($err);
}

$result = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
if (!$result) json_error('AI returned an empty response. Try again.');

json_ok(['result' => $result, 'mode' => $mode]);