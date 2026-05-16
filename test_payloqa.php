<?php
require_once __DIR__ . '/bootstrap.php';

$urls = [
    'api.payloqa.com'      => 'https://api.payloqa.com',
    'payments.payloqa.com' => 'https://payments.payloqa.com',
    'auth.payloqa.com'     => 'https://auth.payloqa.com',
    'sms.payloqa.com'      => 'https://sms.payloqa.com',
];

$results = [];
foreach ($urls as $name => $url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $r = curl_exec($ch);
    $e = curl_error($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $results[$name] = ['reached' => !empty($r), 'http_code' => $code, 'error' => $e];
}

echo json_encode($results, JSON_PRETTY_PRINT);