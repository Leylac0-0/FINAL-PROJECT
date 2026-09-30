<?php
// Only needed for:  php -S localhost:8000 router.php   (XAMPP/Apache does not use this file)
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

if (strpos($path, '/api/') === 0) {
    require __DIR__ . '/api/index.php';
    return true;
}
// Block the private folders
if (preg_match('#^/(includes|database)/#', $path)) {
    http_response_code(403);
    echo 'Forbidden';
    return true;
}
return false; // serve everything else normally
