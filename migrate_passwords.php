<?php
require_once __DIR__ . '/bootstrap.php';

// Process 10 students at a time
$students = $conn->query("SELECT id, index_number FROM students WHERE password IS NULL LIMIT 10");
$count = 0;

while ($row = $students->fetch_assoc()) {
    $hashed = password_hash($row['index_number'], PASSWORD_DEFAULT);
    $upd = $conn->prepare("UPDATE students SET password = ? WHERE id = ?");
    $upd->bind_param('si', $hashed, $row['id']);
    $upd->execute();
    $count++;
}

// Check how many remain
$remaining = $conn->query("SELECT COUNT(*) as c FROM students WHERE password IS NULL")->fetch_assoc()['c'];

echo json_encode(['migrated_this_batch' => $count, 'remaining' => $remaining]);