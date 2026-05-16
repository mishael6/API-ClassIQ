<?php
require_once __DIR__ . '/bootstrap.php';

// Test 1: Can Render reach Google?
$ch1 = curl_init('https://www.google.com');
curl_setopt($ch1, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch1, CURLOPT_TIMEOUT, 10);
$r1 = curl_exec($ch1);
$e1 = curl_error($ch1);
curl_close($ch1);

// Test 2: Can Render reach Payloqa main site?
$ch2 = curl_init('https://payloqa.com');
curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch2, CURLOPT_TIMEOUT, 10);
$r2 = curl_exec($ch2);
$e2 = curl_error($ch2);
curl_close($ch2);

// Test 3: Can Render reach Groq? (already works)
$ch3 = curl_init('https://api.groq.com');
curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch3, CURLOPT_TIMEOUT, 10);
$r3 = curl_exec($ch3);
$e3 = curl_error($ch3);
curl_close($ch3);

echo json_encode([
    'google'  => ['reached' => !empty($r1), 'error' => $e1],
    'payloqa' => ['reached' => !empty($r2), 'error' => $e2],
    'groq'    => ['reached' => !empty($r3), 'error' => $e3],
]);