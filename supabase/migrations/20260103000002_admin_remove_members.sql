-- Define helper function validation check for admin
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Allow Admins to delete any member from chat rooms
-- First drop to ensure clean slate (idempotent)
DROP POLICY IF EXISTS "members_delete_by_admin" ON public.chat_room_members;

CREATE POLICY "members_delete_by_admin"
ON public.chat_room_members FOR DELETE
TO authenticated
USING (
    public.auth_is_admin()
);
