<?php
// api/ai/extract.php
// Accepts a base64-encoded PDF or image and extracts text from it.
// For images: uses Groq vision model to describe/extract content.
// For PDFs: decodes and sends text chunks extracted from the PDF bytes.

require_once __DIR__ . '/../bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body       = get_body();
$type       = trim($body['type']       ?? '');   // 'pdf' | 'image'
$data_b64   = trim($body['data']       ?? '');   // base64 file content
$student_id = (int)($body['student_id'] ?? 0);
$mime       = trim($body['mime']       ?? 'image/jpeg'); // mime type for images

if (!$student_id) json_error('Student ID required.');
if (!$data_b64)  json_error('No file data provided.');
if (!in_array($type, ['pdf', 'image'])) json_error('Invalid file type. Use pdf or image.');

$api_key = getenv('GROQ_API_KEY');
if (!$api_key) json_error('AI service not configured.');

// ── PDF extraction ───────────────────────────────────────────────────────────
if ($type === 'pdf') {
    // Decode PDF bytes
    $pdf_bytes = base64_decode($data_b64);
    if (!$pdf_bytes) json_error('Invalid PDF data.');

    // Save to a temp file
    $tmp = sys_get_temp_dir() . '/classiq_' . uniqid() . '.pdf';
    file_put_contents($tmp, $pdf_bytes);

    // Try pdftotext (poppler-utils) if available on the server
    $text = '';
    if (function_exists('exec')) {
        $txt_out = sys_get_temp_dir() . '/classiq_' . uniqid() . '.txt';
        exec("pdftotext -enc UTF-8 " . escapeshellarg($tmp) . " " . escapeshellarg($txt_out) . " 2>/dev/null", $out, $code);
        if ($code === 0 && file_exists($txt_out)) {
            $text = file_get_contents($txt_out);
            @unlink($txt_out);
        }
    }
    @unlink($tmp);

    // Fallback: if no pdftotext, ask Groq to summarise the binary (won't work well)
    // Instead, return an error so user knows PDF text extraction failed server-side
    if (!$text || strlen(trim($text)) < 20) {
        // Try a simple regex extraction of readable ASCII text from PDF bytes
        $raw = base64_decode($data_b64);
        preg_match_all('/BT\s*(.*?)\s*ET/s', $raw, $matches);
        $chunks = [];
        foreach ($matches[1] as $block) {
            preg_match_all('/\(([^)]+)\)/', $block, $str_matches);
            foreach ($str_matches[1] as $s) {
                $chunks[] = $s;
            }
        }
        $text = implode(' ', $chunks);
    }

    if (!$text || strlen(trim($text)) < 10) {
        json_error('Could not extract text from this PDF. Please copy-paste the text instead, or upload a scanned image.');
    }

    // Trim to 15000 chars
    $text = mb_substr(trim($text), 0, 15000);
    json_ok(['text' => $text, 'source' => 'pdf']);
}

// ── Image extraction (OCR via Groq vision) ───────────────────────────────────
if ($type === 'image') {
    // Validate base64
    if (!preg_match('/^[A-Za-z0-9+\/=]+$/', $data_b64)) {
        json_error('Invalid image data.');
    }

    // Build vision prompt
    $prompt = "You are Six, an AI study assistant. The student has uploaded an image of study material (notes, textbook page, handwriting, or a diagram). Extract ALL readable text from this image exactly as written. Then, below the extracted text, add a section '--- Six says ---' where you briefly explain the content in simple terms. If the image contains a diagram or chart, describe it clearly.";

    $payload = json_encode([
        'model'    => 'meta-llama/llama-4-scout-17b-16e-instruct',
        'messages' => [
            [
                'role'    => 'user',
                'content' => [
                    [
                        'type' => 'text',
                        'text' => $prompt,
                    ],
                    [
                        'type'      => 'image_url',
                        'image_url' => [
                            'url' => "data:{$mime};base64,{$data_b64}",
                        ],
                    ],
                ],
            ],
        ],
        'max_tokens'  => 2000,
        'temperature' => 0.3,
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

    if (!$response) json_error('Six vision is unavailable right now. Try again shortly.');

    $data = json_decode($response, true);

    if ($http_code !== 200) {
        $err = $data['error']['message'] ?? 'AI vision service error.';
        json_error($err);
    }

    $result = $data['choices'][0]['message']['content'] ?? '';
    if (!$result) json_error('Six could not read the image. Try a clearer photo.');

    json_ok(['text' => $result, 'source' => 'image']);
}
