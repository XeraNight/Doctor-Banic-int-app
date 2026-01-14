-- Check all notifications in the database (bypassing RLS)
SET ROLE postgres;
SELECT 
    id,
    user_id,
    type,
    title,
    message,
    is_read,
    created_at
FROM public.notifications
ORDER BY created_at DESC
LIMIT 10;

-- Check if triggers exist
SELECT 
    tgname, 
    tgrelid::regclass AS table_name,
    tgenabled
FROM pg_trigger 
WHERE tgname LIKE '%patient%' OR tgname LIKE '%notification%';

-- Check user_roles to see admin/doctor IDs
SELECT user_id, role
FROM public.user_roles
WHERE role IN ('admin', 'doctor')
LIMIT 5;
