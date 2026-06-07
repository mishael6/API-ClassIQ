<?php
// api/admin/send_bulk_sms.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body    = get_body();
$message = trim($body['message'] ?? '');

if (!$message) json_error('Message content is required.');

// Fetch all student phone numbers
$students = $conn->query("SELECT phone FROM students WHERE phone IS NOT NULL AND phone != ''");
$count = 0;

while ($row = $students->fetch_assoc()) {
    send_admin_sms($row['phone'], $message);
    $count++;
}

json_ok(['message' => "Bulk SMS sent to $count students."]);
