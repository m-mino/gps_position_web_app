CREATE DATABASE IF NOT EXISTS `gps_position_testing`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `gps_position_testing`.* TO 'gps_position'@'%';
FLUSH PRIVILEGES;
