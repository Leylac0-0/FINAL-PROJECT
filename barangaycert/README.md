# BarangayCert System (PHP version)

PHP + MySQL version of the BarangayCert system. The pages are now `.php`, and the
Node/Express + MongoDB backend was replaced by a PHP API in the `api/` folder.
The look and behaviour of the pages are unchanged.

## Run it with XAMPP (easiest)

1. Install XAMPP and start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Copy this whole folder into `C:\xampp\htdocs\` (so you get `C:\xampp\htdocs\barangaycert-php\`).
3. Open **http://localhost/barangaycert-php/** in your browser.

That's it. The first time the site is opened it creates the `barangaycert`
database and the tables by itself. Nothing to import.

Then click **Register Profile** on the Resident Portal and on the Secretary
Portal to create your first accounts.

## Database settings

`includes/config.php` uses the XAMPP defaults (host `127.0.0.1`, user `root`,
empty password, database `barangaycert`). If your MySQL is different, edit that
file, or set the environment variables `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER`, `DB_PASS`.

Prefer to create the tables yourself? Import `database/schema.sql` in phpMyAdmin.

## Run without XAMPP (PHP built-in server)

Needs PHP 8+ with the `pdo_mysql` extension and a running MySQL/MariaDB:

    php -S localhost:8000 router.php

Then open http://localhost:8000/

## Folder layout

    index.php, resident.php, secretary.php   the pages (was .html)
    style.css, script.js, details.js         frontend assets
    api/index.php                            all API endpoints (was routes/*.js)
    api/.htaccess                            sends /api/... to api/index.php
    includes/                                config, database connection, helpers (browser access blocked)
    database/schema.sql                      the two tables: users, requests
    router.php                               only for `php -S`

## What changed from the Node version

- MongoDB Atlas -> MySQL (users and requests tables). Node/npm/.env are no longer needed.
- Login sessions use PHP sessions; passwords are stored with `password_hash()`.
- `script.js`: one line changed, `API_BASE_URL` is now `'api'` (relative) so the site
  works from any folder, not only from the domain root.
- Added a **Logout** button (both portals) and a **profile update prompt** after a
  resident logs in (`details.js`, endpoint `PATCH api/auth/profile`).

## Requirements

Apache with `mod_rewrite` (on by default in XAMPP), PHP 8.0+, MySQL 5.7+ / MariaDB 10.3+.
