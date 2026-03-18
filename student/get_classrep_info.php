<?php
// api/student/get_classrep_info.php
require_once __DIR__ . '/../bootstrap.php';

$classrep_id = (int)($_GET['classrep_id'] ?? 0);
if (!$classrep_id) json_error('Invalid classrep ID.');

$stmt = $conn->prepare("SELECT id, name, institution, department, program FROM users WHERE id = ? AND status = 'approved' LIMIT 1");
$stmt->bind_param('i', $classrep_id);
$stmt->execute();
$classrep = $stmt->get_result()->fetch_assoc();

if (!$classrep) json_error('Class representative not found.');

json_ok(['classrep' => $classrep]);