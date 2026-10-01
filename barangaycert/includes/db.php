<?php
require_once __DIR__ . '/config.php';

/**
 * Returns a shared PDO connection.
 * On first run it creates the database and tables automatically,
 * so you do not have to import anything by hand (database/schema.sql is
 * only there in case you prefer to import it yourself in phpMyAdmin).
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $dsnBase = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsnBase . ';dbname=' . DB_NAME, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        // 1049 = "Unknown database" -> create it, then connect again
        if ((int)$e->getCode() !== 1049) {
            throw $e;
        }
        $tmp = new PDO($dsnBase, DB_USER, DB_PASS, $options);
        $tmp->exec('CREATE DATABASE IF NOT EXISTS `' . str_replace('`', '', DB_NAME) . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo = new PDO($dsnBase . ';dbname=' . DB_NAME, DB_USER, DB_PASS, $options);
    }

    // Create the tables if they are not there yet
    try {
        $pdo->query('SELECT 1 FROM users LIMIT 1');
        $pdo->query('SELECT 1 FROM requests LIMIT 1');
    } catch (PDOException $e) {
        $pdo->exec(file_get_contents(__DIR__ . '/../database/schema.sql'));
    }

    return $pdo;
}
