-- Allow creators to UPDATE their chat rooms (e.g. rename)
DROP POLICY IF EXISTS "rooms_update" ON public.chat_rooms;
CREATE POLICY "rooms_update"
ON public.chat_rooms FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Allow creators to DELETE their chat rooms
DROP POLICY IF EXISTS "rooms_delete" ON public.chat_rooms;
CREATE POLICY "rooms_delete"
ON public.chat_rooms FOR DELETE
TO authenticated
USING (created_by = auth.uid());
