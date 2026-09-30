<?php
require_once __DIR__ . '/db.php';

const CATEGORIES_RESIDENT = ['General Resident', 'Senior Citizen', 'PWD / Solo Parent'];
const CATEGORY_SECRETARY  = 'Secretary';
const STATUSES            = ['PENDING', 'APPROVED', 'REJECTED', 'RELEASED'];

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.gc_maxlifetime', (string)SESSION_LIFETIME);
    session_name('BARANGAYCERTSESSID');
    session_set_cookie_params([
        'lifetime' => SESSION_LIFETIME,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Send a JSON response and stop. */
function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** JSON request body as an array (empty array if none / invalid). */
function json_body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    return is_array($data) ? $data : [];
}

/** The logged-in user row, or null. */
function current_user(): ?array
{
    start_session();
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    return $stmt->fetch() ?: null;
}

/** Stops with 401 if nobody is logged in. */
function require_login(): array
{
    start_session();
    if (empty($_SESSION['user_id'])) {
        json_response(['message' => 'You must log in first.'], 401);
    }
    $user = current_user();
    if (!$user) {
        json_response(['message' => 'Session invalid.'], 401);
    }
    return $user;
}

/** Converts a DB request row into the JSON shape the frontend expects. */
function request_to_json(array $r): array
{
    return [
        'trackingId'       => $r['tracking_id'],
        'residentUsername' => $r['resident_username'],
        'residentName'     => $r['resident_name'],
        'category'         => $r['category'],
        'documentType'     => $r['document_type'],
        'purpose'          => $r['purpose'],
        'status'           => $r['status'],
        'createdAt'        => $r['created_at'],
        'updatedAt'        => $r['updated_at'],
    ];
}

/** "BC-482913" style code, guaranteed not to exist yet. */
function generate_tracking_id(): string
{
    $stmt = db()->prepare('SELECT 1 FROM requests WHERE tracking_id = ?');
    do {
        $id = 'BC-' . random_int(100000, 999999);
        $stmt->execute([$id]);
    } while ($stmt->fetchColumn());
    return $id;
}
