-- Fix department column type from date to text
-- Run this in Supabase SQL Editor

-- First check current column type
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'department';

-- If department column exists and is DATE type, change it to TEXT
ALTER TABLE jobs 
ALTER COLUMN department TYPE TEXT;

-- Verify the change
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' AND column_name = 'department';
