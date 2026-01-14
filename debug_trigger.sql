-- Check if the trigger and function exist on the remote database
-- Run this in the SQL Editor in Supabase Studio

-- 1. Check if the trigger function exists
SELECT 
    proname AS function_name,
    pg_get_functiondef(oid) AS function_definition
FROM pg_proc
WHERE proname IN ('notify_on_new_patient', 'notify_on_new_patient_simple')
ORDER BY proname;

-- 2. Check if the trigger exists and is enabled
SELECT 
    t.tgname AS trigger_name,
    t.tgrelid::regclass AS table_name,
    t.tgenabled AS enabled,
    pg_get_triggerdef(t.oid) AS trigger_definition
FROM pg_trigger t
WHERE t.tgname LIKE '%patient%'
ORDER BY t.tgname;

-- 3. Check user_roles table
SELECT role, COUNT(*) as count
FROM public.user_roles
GROUP BY role;

-- 4. Check if any notifications exist
SELECT COUNT(*) as notification_count
FROM public.notifications;

-- 5. Test manual insert into notifications
INSERT INTO public.notifications (user_id, type, title, message, link)
SELECT 
    user_id,
    'system',
    'Manual Test',
    'This is a manual test notification',
    '/dashboard'
FROM public.user_roles
WHERE role = 'admin'
LIMIT 1;

-- Verify it was inserted
SELECT * FROM public.notifications ORDER BY created_at DESC LIMIT 5;
