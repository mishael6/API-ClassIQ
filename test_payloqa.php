<?php
require_once __DIR__ . '/bootstrap.php';

$payloqa_key = getenv('PAYLOQA_API_KEY');

$payload = json_encode([
    'amount'       => 1.00,
    'currency'     => 'GHS',
    'phone'        => '0502076920',
    'network'      => 'vodafone',
    'reference'    => 'TEST-' . time(),
    'description'  => 'Test payment',
    'callback_url' => 'https://api-classiq.onrender.com/ai/payment_callback.php',
]);

$ch = curl_init('https://api.payloqa.com/v1/collections/mobile-money');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    "Authorization: Bearer $payloqa_key",
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

$response   = curl_exec($ch);
$http_code  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);

echo json_encode([
    'http_code'    => $http_code,
    'curl_error'   => $curl_error,
    'response'     => $response,
    'key_set'      => !empty($payloqa_key),
]);