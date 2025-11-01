-- Adds state and city columns to CP leads table if they do not already exist
-- Run this on each tenant database as needed

ALTER TABLE `db_channel_partner_leads`
	ADD COLUMN `state` VARCHAR(255) NULL AFTER `email`;

ALTER TABLE `db_channel_partner_leads`
	ADD COLUMN `city` VARCHAR(255) NULL AFTER `state`;
