<?php
/**
 * BarangayCert API  (PHP replacement for the Express routes)
 *
 *   POST   api/auth/register
 *   POST   api/auth/login
 *   GET    api/auth/me
 *   POST   api/auth/logout
 *   PATCH  api/auth/profile                 (update name / category / password)
 *   GET    api/metrics
 *   POST   api/requests
 *   GET    api/requests
 *   GET    api/requests/my-requests
 *   GET    api/requests/verify/{trackingId}
 *   PATCH  api/requests/{trackingId}/status
 */
require_once __DIR__ . '/../includes/helpers.php';

// Work out the part of the URL after ".../api"
$uri  = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$pos  = strrpos($uri, '/api/');
$path = $pos !== false ? substr($uri, $pos + 4) : '/';   // e.g. "/auth/me"
$path = '/' . trim(rawurldecode($path), '/');
$method = $_SERVER['REQUEST_METHOD'];

try {
    // ------------------------------------------------------------------ AUTH
    if ($path === '/auth/register' && $method === 'POST') {
        $b        = json_body();
        $username = trim((string)($b['username'] ?? ''));
        $password = (string)($b['password'] ?? '');
        $name     = trim((string)($b['name'] ?? ''));
        $category = (string)($b['category'] ?? '');

        if ($username === '' || $password === '') {
            json_response(['message' => 'Username and password are required.'], 400);
        }
        if (!in_array($category, array_merge(CATEGORIES_RESIDENT, [CATEGORY_SECRETARY]), true)) {
            $category = 'General Resident';
        }
        if ($name === '') {
            $name = 'Given Name Surname';
        }

        $stmt = db()->prepare('SELECT 1 FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->fetchColumn()) {
            json_response(['message' => 'Username already taken. Bawal duplicate!'], 409);
        }

        $stmt = db()->prepare('INSERT INTO users (username, password_hash, name, category) VALUES (?, ?, ?, ?)');
        $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $name, $category]);

        start_session();
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)db()->lastInsertId();

        json_response(['name' => $name, 'category' => $category], 201);
    }

    if ($path === '/auth/login' && $method === 'POST') {
        $b        = json_body();
        $username = trim((string)($b['username'] ?? ''));
        $password = (string)($b['password'] ?? '');

        $stmt = db()->prepare('SELECT * FROM users WHERE username = ?');
        $stmt->execute([$username]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_response(['message' => 'Incorrect password or user not found!'], 401);
        }

        start_session();
        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];

        json_response(['name' => $user['name'], 'category' => $user['category']]);
    }

    if ($path === '/auth/me' && $method === 'GET') {
        start_session();
        if (empty($_SESSION['user_id'])) {
            json_response(['message' => 'Not logged in.'], 401);
        }
        $user = current_user();
        if (!$user) {
            json_response(['message' => 'Session invalid.'], 401);
        }
        json_response(['name' => $user['name'], 'category' => $user['category'], 'username' => $user['username']]);
    }

    if ($path === '/auth/logout' && $method === 'POST') {
        start_session();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
        json_response(['message' => 'Logged out.']);
    }

    if ($path === '/auth/profile' && $method === 'PATCH') {
        $user     = require_login();
        $b        = json_body();
        $name     = trim((string)($b['name'] ?? ''));
        $category = (string)($b['category'] ?? '');
        $password = (string)($b['password'] ?? '');

        if ($name === '') {
            $name = $user['name'];
        }
        // Secretary accounts keep their category; residents can only pick resident categories
        if ($user['category'] === CATEGORY_SECRETARY || !in_array($category, CATEGORIES_RESIDENT, true)) {
            $category = $user['category'];
        }

        if ($password !== '') {
            $stmt = db()->prepare('UPDATE users SET name = ?, category = ?, password_hash = ? WHERE id = ?');
            $stmt->execute([$name, $category, password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        } else {
            $stmt = db()->prepare('UPDATE users SET name = ?, category = ? WHERE id = ?');
            $stmt->execute([$name, $category, $user['id']]);
        }

        // Keep the resident's unreleased requests in sync with the new details
        $stmt = db()->prepare(
            "UPDATE requests SET resident_name = ?, category = ?
             WHERE resident_username = ? AND status <> 'RELEASED'"
        );
        $stmt->execute([$name, $category, $user['username']]);

        json_response(['name' => $name, 'category' => $category, 'username' => $user['username']]);
    }

    // --------------------------------------------------------------- METRICS
    if ($path === '/metrics' && $method === 'GET') {
        $count = function (string $where, array $params = []) {
            $stmt = db()->prepare("SELECT COUNT(*) FROM users WHERE $where");
            $stmt->execute($params);
            return (int)$stmt->fetchColumn();
        };
        json_response([
            'total'  => $count('category <> ?', [CATEGORY_SECRETARY]),
            'senior' => $count('category = ?', ['Senior Citizen']),
            'pwd'    => $count('category = ?', ['PWD / Solo Parent']),
        ]);
    }

    // -------------------------------------------------------------- REQUESTS
    if ($path === '/requests' && $method === 'POST') {
        $user         = require_login();
        $b            = json_body();
        $documentType = trim((string)($b['documentType'] ?? ''));
        $purpose      = trim((string)($b['purpose'] ?? ''));

        if ($documentType === '' || $purpose === '') {
            json_response(['message' => 'Document type and purpose are required.'], 400);
        }

        $trackingId = generate_tracking_id();
        $stmt = db()->prepare(
            'INSERT INTO requests (tracking_id, resident_username, resident_name, category, document_type, purpose, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([$trackingId, $user['username'], $user['name'], $user['category'], $documentType, $purpose, 'PENDING']);

        $stmt = db()->prepare('SELECT * FROM requests WHERE tracking_id = ?');
        $stmt->execute([$trackingId]);
        json_response(request_to_json($stmt->fetch()), 201);
    }

    if ($path === '/requests' && $method === 'GET') {
        $rows = db()->query('SELECT * FROM requests ORDER BY created_at DESC, id DESC')->fetchAll();
        json_response(array_map('request_to_json', $rows));
    }

    if ($path === '/requests/my-requests' && $method === 'GET') {
        $user = require_login();
        $stmt = db()->prepare('SELECT * FROM requests WHERE resident_username = ? ORDER BY created_at DESC, id DESC');
        $stmt->execute([$user['username']]);
        json_response(array_map('request_to_json', $stmt->fetchAll()));
    }

    if ($method === 'GET' && preg_match('#^/requests/verify/(.+)$#', $path, $m)) {
        $stmt = db()->prepare('SELECT * FROM requests WHERE tracking_id = ?');
        $stmt->execute([$m[1]]);
        $row = $stmt->fetch();
        if (!$row) {
            json_response(['message' => 'No matching request found.'], 404);
        }
        json_response(request_to_json($row));
    }

    if ($method === 'PATCH' && preg_match('#^/requests/([^/]+)/status$#', $path, $m)) {
        $status = (string)(json_body()['status'] ?? '');
        if (!in_array($status, STATUSES, true)) {
            json_response(['message' => 'Invalid status value.'], 400);
        }

        $stmt = db()->prepare('SELECT * FROM requests WHERE tracking_id = ?');
        $stmt->execute([$m[1]]);
        if (!$stmt->fetch()) {
            json_response(['message' => 'Request not found.'], 404);
        }

        db()->prepare('UPDATE requests SET status = ? WHERE tracking_id = ?')->execute([$status, $m[1]]);

        $stmt = db()->prepare('SELECT * FROM requests WHERE tracking_id = ?');
        $stmt->execute([$m[1]]);
        json_response(request_to_json($stmt->fetch()));
    }

    json_response(['message' => 'Not found.'], 404);

} catch (PDOException $e) {
    error_log('BarangayCert DB error: ' . $e->getMessage());
    json_response(['message' => 'Database error. Please check includes/config.php and that MySQL is running.'], 500);
} catch (Throwable $e) {
    error_log('BarangayCert error: ' . $e->getMessage());
    json_response(['message' => 'Server error.'], 500);
}
