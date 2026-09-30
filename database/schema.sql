CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(150) NOT NULL,
  category      ENUM('General Resident','Senior Citizen','PWD / Solo Parent','Secretary')
                NOT NULL DEFAULT 'General Resident',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS requests (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tracking_id       VARCHAR(20)  NOT NULL UNIQUE,
  resident_username VARCHAR(100) NOT NULL,
  resident_name     VARCHAR(150) NOT NULL,
  category          VARCHAR(50)  NOT NULL,
  document_type     VARCHAR(100) NOT NULL,
  purpose           VARCHAR(255) NOT NULL,
  status            ENUM('PENDING','APPROVED','REJECTED','RELEASED') NOT NULL DEFAULT 'PENDING',
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_resident (resident_username),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
