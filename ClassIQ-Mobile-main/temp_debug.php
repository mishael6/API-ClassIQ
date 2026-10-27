<?php
require "C:/Users/hp/Desktop/api/db.php";
$res = $conn->query("DESCRIBE troubleshooting_logs")->fetch_all(MYSQLI_ASSOC);
print_r($res);
