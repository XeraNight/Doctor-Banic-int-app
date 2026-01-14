-- Fix infinite recursion in chat policies
-- We replace the function-based approach with a split-policy approach that has a clear termination condition.

-- 1. Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.chat_messages;

-- 2. Chat Room Members: Split into "View Own" and "View Others via Room"
-- This is the BASE CASE for the recursion. Users can ALWAYS see their own membership rows.
CREATE POLICY "view_own_membership"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Chat Rooms: Visible if I created it OR if I have a membership row
-- The subquery here hits 'chat_room_members'. 
-- For my own rows, 'view_own_membership' returns TRUE immediately, terminating the check.
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

-- 4. Chat Room Members (Recursion Step): View others if I can see the room
-- This depends on 'chat_rooms' being visible.
CREATE POLICY "view_members_of_accessible_rooms"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (
    room_id IN (
        SELECT id 
        FROM public.chat_rooms
    )
);

-- 5. Chat Messages: View if I can see the room
CREATE POLICY "view_messages_of_accessible_rooms"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
    room_id IN (
        SELECT id 
        FROM public.chat_rooms
    )
);
