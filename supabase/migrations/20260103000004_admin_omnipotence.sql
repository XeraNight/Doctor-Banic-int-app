-- Fix auth_is_admin to check user_roles table (roles are NOT in profiles!)
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::public.app_role
  );
$$;

-- 1. Chat Rooms: Admin Omnipotence
DROP POLICY IF EXISTS "admin_all_chat_rooms" ON public.chat_rooms;
CREATE POLICY "admin_all_chat_rooms"
ON public.chat_rooms
FOR ALL
TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- 2. Chat Members: Admin Omnipotence
DROP POLICY IF EXISTS "admin_all_chat_members" ON public.chat_room_members;
CREATE POLICY "admin_all_chat_members"
ON public.chat_room_members
FOR ALL
TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- 3. Chat Messages: Admin Omnipotence
DROP POLICY IF EXISTS "admin_all_chat_messages" ON public.chat_messages;
CREATE POLICY "admin_all_chat_messages"
ON public.chat_messages
FOR ALL
TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- 4. Profiles: Admin Omnipotence (Crucial for seeing member details)
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
CREATE POLICY "admin_all_profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());

-- 5. User Roles: Admin Omnipotence
DROP POLICY IF EXISTS "admin_all_user_roles" ON public.user_roles;
CREATE POLICY "admin_all_user_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.auth_is_admin())
WITH CHECK (public.auth_is_admin());
