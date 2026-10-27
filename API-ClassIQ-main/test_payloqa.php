<?php
require_once __DIR__ . '/bootstrap.php';

$payloqa_key      = getenv('PAYLOQA_API_KEY');
$payloqa_platform = getenv('PAYLOQA_PLATFORM_ID');

$payload = json_encode([
    'amount'         => 1.00,
    'currency'       => 'GHS',
    'payment_method' => 'mobile_money',
    'phone_number'   => '233502076920',
    'network'        => 'vodafone',
    'offline'        => true,
    'payment_flow'   => 'direct',
    'webhook_url'    => 'https://api-classiq.onrender.com/ai/payment_callback.php',
    'metadata'       => ['test' => true],
]);

$ch = curl_init('https://payments.payloqa.com/api/v1/payments/create');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    "X-API-Key: $payloqa_key",
    "X-Platform-Id: $payloqa_platform",
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response   = curl_exec($ch);
$http_code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

echo json_encode([
    'http_code'  => $http_code,
    'curl_error' => $curl_error,
    'response'   => json_decode($response),
]);