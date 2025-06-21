CREATE TABLE IF NOT EXISTS `player_bans` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reason` VARCHAR(255) NOT NULL,
    `banned_by` VARCHAR(100) NOT NULL,
    `identifier` JSON NOT NULL,
    `ip_address` VARCHAR(45),
    `hwid_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `note` TEXT,
    `automatic` BOOLEAN NOT NULL DEFAULT FALSE,
    `ban_identifier` VARCHAR(64) NOT NULL,
    `evidence_urls` JSON NOT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_ban_identifier` (`ban_identifier`)
);
