-- Allow Admins to see all members of all chat rooms
-- This ensures the "Manage Members" list is populated even if the admin is not implicitly a member via other policies

DROP POLICY IF EXISTS "members_select_by_admin" ON public.chat_room_members;
CREATE POLICY "members_select_by_admin"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (
    public.auth_is_admin()
);
