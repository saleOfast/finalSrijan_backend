-- Adds state and city columns to db_user table if they do not already exist
-- Run this on each tenant database as needed

ALTER TABLE `db_user`
	ADD COLUMN `state` VARCHAR(255) NULL AFTER `state_id`;

ALTER TABLE `db_user`
	ADD COLUMN `city` VARCHAR(255) NULL AFTER `city_id`;


