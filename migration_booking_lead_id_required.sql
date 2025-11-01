-- Migration script to make lead_id required in db_lead_booking table
-- Run this script to enforce lead_id as mandatory for all bookings
-- Date: 2024-01-15
-- Description: Makes lead_id NOT NULL and adds foreign key constraint

-- ⚠️ WARNING: This migration will fail if there are existing bookings without leads
-- Check for null lead_ids first before running this script

-- Start transaction
START TRANSACTION;

-- Step 1: Check for existing bookings without leads
SELECT 
    booking_id,
    erp_booking_id,
    sales_booking_id,
    booking_name,
    email,
    created_at
FROM db_lead_booking 
WHERE lead_id IS NULL;

-- ⚠️ If the above query returns rows, you must handle them first!
-- Options:
--   1. Delete bookings without leads (if they're test data)
--   2. Assign them to a default lead
--   3. Manually assign correct lead_ids

-- Step 2: (UNCOMMENT TO EXECUTE) Make lead_id NOT NULL
-- This will fail if there are null values in lead_id column
/*
ALTER TABLE db_lead_booking 
MODIFY COLUMN lead_id INT NOT NULL;
*/

-- Step 3: (OPTIONAL) Verify foreign key constraint exists
-- Check if FK constraint already exists
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_NAME = 'db_lead_booking'
AND COLUMN_NAME = 'lead_id'
AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Step 4: (If FK doesn't exist) Add foreign key constraint
-- Uncomment if needed
/*
ALTER TABLE db_lead_booking
ADD CONSTRAINT fk_booking_lead
FOREIGN KEY (lead_id) 
REFERENCES db_leads(lead_id)
ON DELETE RESTRICT 
ON UPDATE CASCADE;
*/

-- Step 5: Create index on lead_id for better query performance
CREATE INDEX IF NOT EXISTS idx_booking_lead_id ON db_lead_booking(lead_id);

-- Verify the changes
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT,
    COLUMN_KEY
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'db_lead_booking' 
AND COLUMN_NAME = 'lead_id';

-- Commit the transaction
-- COMMIT;  -- ⬅️ Uncomment after verifying there are no null lead_ids

-- Show success message
SELECT 'Migration script ready. Review the queries above before executing.' AS status;

