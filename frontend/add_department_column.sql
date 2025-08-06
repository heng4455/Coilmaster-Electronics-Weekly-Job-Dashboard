-- เพิ่มคอลัมน์ department ในตาราง jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS department TEXT;

-- ตรวจสอบโครงสร้างตาราง jobs หลังเพิ่มคอลัมน์
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
ORDER BY ordinal_position;
