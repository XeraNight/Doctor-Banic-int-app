-- Allow any member of a room to add other members
-- (Currently only creators can add)
DROP POLICY IF EXISTS "members_insert_by_members" ON public.chat_room_members;
CREATE POLICY "members_insert_by_members"
ON public.chat_room_members FOR INSERT
TO authenticated
WITH CHECK (
    public.auth_is_member_of_room(room_id)
);

-- Allow members to leave the chat (Delete their own membership)
DROP POLICY IF EXISTS "members_delete_own" ON public.chat_room_members;
CREATE POLICY "members_delete_own"
ON public.chat_room_members FOR DELETE
TO authenticated
USING (
    user_id = auth.uid()
);
