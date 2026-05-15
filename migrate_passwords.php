<?php
require_once __DIR__ . '/bootstrap.php';

$students = $conn->query("SELECT id, index_number FROM students WHERE password IS NULL");
$count = 0;

while ($row = $students->fetch_assoc()) {
    $hashed = password_hash($row['index_number'], PASSWORD_DEFAULT);
    $upd = $conn->prepare("UPDATE students SET password = ? WHERE id = ?");
    $upd->bind_param('si', $hashed, $row['id']);
    $upd->execute();
    $count++;
}

echo json_encode(['migrated' => $count]);