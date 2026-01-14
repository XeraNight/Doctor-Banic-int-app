-- Fix infinite recursion in chat policies (safe version)
-- This version can be run even if policies already exist

-- 1. Drop ALL existing chat policies (safe with IF EXISTS)
DROP POLICY IF EXISTS "view_own_membership" ON public.chat_room_members;
DROP POLICY IF EXISTS "view_accessible_rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "view_members_of_accessible_rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "view_messages_of_accessible_rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.chat_messages;

-- 2. Chat Room Members: BASE CASE - Users can ALWAYS see their own membership
CREATE POLICY "view_own_membership"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Chat Rooms: Visible if created by user OR has membership row
CREATE POLICY "view_accessible_rooms"
ON public.chat_rooms FOR SELECT
TO authenticated
USING (
    created_by = auth.uid() OR
    EXISTS (
        SELECT 1 
        FROM public.chat_room_members 
        WHERE room_id = id 
        AND user_id = auth.uid()
    )
);

-- 4. Chat Room Members: View others if room is accessible
CREATE POLICY "view_members_of_accessible_rooms"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (
    room_id IN (
        SELECT id 
        FROM public.chat_rooms
    )
);

-- 5. Chat Messages: View if room is accessible
CREATE POLICY "view_messages_of_accessible_rooms"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
    room_id IN (
        SELECT id 
        FROM public.chat_rooms
    )
);
