<?php
/**
 * BarangayCert - configuration
 *
 * Defaults match a fresh XAMPP / WAMP install (user "root", no password).
 * On a real host, either edit the values below or set the environment
 * variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS.
 */
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_PORT', getenv('DB_PORT') ?: '3306');
define('DB_NAME', getenv('DB_NAME') ?: 'barangaycert');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') !== false ? getenv('DB_PASS') : '');

// Login session length (7 days, same as the old Node version)
define('SESSION_LIFETIME', 60 * 60 * 24 * 7);
