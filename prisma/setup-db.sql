-- Setup script for MarketInsight database

-- Create database
CREATE DATABASE IF NOT EXISTS marketinsight 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Create user with native password authentication (MySQL 8.0+)
CREATE USER IF NOT EXISTS 'user1'@'localhost' IDENTIFIED WITH mysql_native_password BY '1234';

-- Grant privileges
GRANT ALL PRIVILEGES ON marketinsight.* TO 'user1'@'localhost';

-- Refresh privileges
FLUSH PRIVILEGES;

-- Verify
SELECT user, host FROM mysql.user WHERE user = 'user1';
SHOW GRANTS FOR 'user1'@'localhost';