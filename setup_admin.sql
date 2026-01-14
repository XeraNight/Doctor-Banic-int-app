    -- ============================================
    -- Setup Admin Account for jakubkalina05@gmail.com
    -- User ID: c319cdd9-dc40-4464-aea2-f4c93faacb6e
    -- ============================================

    -- 1. Create profile for admin user
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
    'c319cdd9-dc40-4464-aea2-f4c93faacb6e',
    'jakubkalina05@gmail.com',
    'Jakub Kalina'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

    -- 2. Assign admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
    'c319cdd9-dc40-4464-aea2-f4c93faacb6e',
    'admin'
    )
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 3. Verify the setup
    SELECT 
    p.id,
    p.email,
    p.full_name,
    ur.role,
    p.created_at
    FROM public.profiles p
    LEFT JOIN public.user_roles ur ON p.id = ur.user_id
    WHERE p.id = 'c319cdd9-dc40-4464-aea2-f4c93faacb6e';
