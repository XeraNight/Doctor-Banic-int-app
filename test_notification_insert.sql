-- Insert a test notification for the current user
-- Replace 'YOUR_USER_ID' with actual user ID from auth.users
DO $$
DECLARE
    _test_user_id UUID;
BEGIN
    -- Get the first admin/doctor user ID
    SELECT user_id INTO _test_user_id 
    FROM public.user_roles 
    WHERE role IN ('admin', 'doctor') 
    LIMIT 1;
    
    IF _test_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
        VALUES (
            _test_user_id,
            'system',
            'Test Notification',
            'This is a test notification to verify the system is working',
            '/dashboard',
            false
        );
        
        RAISE NOTICE 'Test notification created for user: %', _test_user_id;
    ELSE
        RAISE NOTICE 'No admin or doctor user found';
    END IF;
END $$;

-- Check recent notifications
SELECT 
    n.id,
    n.user_id,
    n.type,
    n.title,
    n.message,
    n.created_at,
    n.is_read,
    ur.role
FROM public.notifications n
LEFT JOIN public.user_roles ur ON ur.user_id = n.user_id
ORDER BY n.created_at DESC
LIMIT 5;
