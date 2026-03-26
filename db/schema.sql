-- ============================================================
--  QR Registration System — MySQL Schema
--  Run this once in MySQL Workbench or phpMyAdmin
-- ============================================================

CREATE DATABASE IF NOT EXISTS qr_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qr_system;

-- Guest list imported from Excel
CREATE TABLE IF NOT EXISTS guests (
    id             VARCHAR(30)  PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    department     VARCHAR(255) DEFAULT '',
    job_title      VARCHAR(255) DEFAULT '',
    table_number   VARCHAR(50)  DEFAULT '',
    gmail          VARCHAR(255) DEFAULT '',
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Scan / check-in log
CREATE TABLE IF NOT EXISTS registrations (
    id             BIGINT       AUTO_INCREMENT PRIMARY KEY,
    scan_id        VARCHAR(30)  DEFAULT NULL,      -- internal row id
    guest_id       VARCHAR(30)  DEFAULT NULL,      -- links to guests.id (NULL for walk-ins)
    scan_data      VARCHAR(500) NOT NULL,           -- name or raw QR text
    department     VARCHAR(255) DEFAULT '',
    table_no       VARCHAR(50)  DEFAULT '',
    timestamp      VARCHAR(100) NOT NULL,           -- human-readable locale string
    created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
);
