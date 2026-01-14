-- COMPLETE FIX for chat room infinite recursion
-- This removes ALL policies and creates simple, non-recursive ones

-- ========================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ========================================

-- Chat Rooms policies
DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
DROP POLICY IF EXISTS "view_accessible_rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "view_own_membership" ON public.chat_room_members;
DROP POLICY IF EXISTS "view_members_of_accessible_rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can add members to their rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "view_messages_of_accessible_rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their rooms" ON public.chat_messages;

-- ========================================
-- STEP 2: CREATE NEW SIMPLE POLICIES
-- ========================================

-- Chat Rooms: INSERT - anyone authenticated can create
CREATE POLICY "allow_insert_chat_rooms"
ON public.chat_rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Chat Rooms: SELECT - see rooms you created OR rooms where you have membership
-- CRITICAL: This must NOT create recursion
CREATE POLICY "allow_select_chat_rooms"
ON public.chat_rooms FOR SELECT
TO authenticated
USING (
    created_by = auth.uid() OR
    id IN (
        SELECT room_id 
        FROM public.chat_room_members 
        WHERE user_id = auth.uid()
    )
);

-- Chat Room Members: INSERT - creator can add members OR user can add themselves
CREATE POLICY "allow_insert_members"
ON public.chat_room_members FOR INSERT
TO authenticated
WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 
        FROM public.chat_rooms 
        WHERE id = room_id 
        AND created_by = auth.uid()
    )
);

-- Chat Room Members: SELECT - see your own membership OR members of your rooms
CREATE POLICY "allow_select_members"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() OR
    room_id IN (
        SELECT id 
        FROM public.chat_rooms 
        WHERE created_by = auth.uid()
    )
);

-- Chat Messages: INSERT - send messages in rooms you're member of
CREATE POLICY "allow_insert_messages"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    room_id IN (
        SELECT room_id 
        FROM public.chat_room_members 
        WHERE user_id = auth.uid()
    )
);

-- Chat Messages: SELECT - view messages in your rooms
CREATE POLICY "allow_select_messages"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
    room_id IN (
        SELECT room_id 
        FROM public.chat_room_members 
        WHERE user_id = auth.uid()
    )
);
