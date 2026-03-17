<?php
// api/admin/send_message.php
require_once __DIR__ . '/../bootstrap.php';
require_admin($conn);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_error('Method not allowed', 405);

$body           = get_body();
$recipient_type = $body['recipient_type'] ?? 'classrep';
$recipient_id   = (int)($body['recipient_id'] ?? 0);
$subject        = trim($body['subject'] ?? '');
$message        = trim($body['message'] ?? '');

if (!$subject || !$message) json_error('Subject and message are required.');

$recipients = [];

if ($recipient_type === 'all') {
    $rows = $conn->query("SELECT name, email FROM users ORDER BY name")->fetch_all(MYSQLI_ASSOC);
    $recipients = $rows;
} else {
    if (!$recipient_id) json_error('Recipient is required.');
    $stmt = $conn->prepare("SELECT name, email FROM users WHERE id = ? LIMIT 1");
    $stmt->bind_param('i', $recipient_id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    if (!$row) json_error('Recipient not found.');
    $recipients[] = $row;
}

$sent = 0;
foreach ($recipients as $r) {
    $headers  = "From: ClassIQ Admin <noreply@classiq.app>\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body_text = "Dear {$r['name']},\n\n{$message}\n\n— ClassIQ Admin Team";

    if (mail($r['email'], $subject, $body_text, $headers)) {
        $sent++;
    }
}

if ($sent === 0) json_error('Failed to send email. Check server mail configuration.');

json_ok(['message' => "Message sent to $sent recipient(s).", 'sent' => $sent]);
