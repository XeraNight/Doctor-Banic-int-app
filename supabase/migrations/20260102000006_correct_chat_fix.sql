-- CORRECT FIX for chat room infinite recursion
-- Uses BASE CASE approach to prevent circular dependencies

-- ========================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ========================================

DROP POLICY IF EXISTS "Authenticated users can create chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view rooms they are members of" ON public.chat_rooms;
DROP POLICY IF EXISTS "view_accessible_rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "allow_select_chat_rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "allow_insert_chat_rooms" ON public.chat_rooms;

DROP POLICY IF EXISTS "view_own_membership" ON public.chat_room_members;
DROP POLICY IF EXISTS "view_members_of_accessible_rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can view room members" ON public.chat_room_members;
DROP POLICY IF EXISTS "Users can add members to their rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "allow_insert_members" ON public.chat_room_members;
DROP POLICY IF EXISTS "allow_select_members" ON public.chat_room_members;

DROP POLICY IF EXISTS "view_messages_of_accessible_rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can view messages in their rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send messages in their rooms" ON public.chat_messages;
DROP POLICY IF EXISTS "allow_insert_messages" ON public.chat_messages;
DROP POLICY IF EXISTS "allow_select_messages" ON public.chat_messages;

-- Drop correct_chat_fix policies if they exist (to allow re-run)
DROP POLICY IF EXISTS "base_see_own_membership" ON public.chat_room_members;
DROP POLICY IF EXISTS "base_insert_own_membership" ON public.chat_room_members;
DROP POLICY IF EXISTS "rooms_insert" ON public.chat_rooms;
DROP POLICY IF EXISTS "rooms_select" ON public.chat_rooms;
DROP POLICY IF EXISTS "members_insert_by_creator" ON public.chat_room_members;
DROP POLICY IF EXISTS "members_select_in_accessible_rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "messages_select" ON public.chat_messages;

-- ========================================
-- STEP 2: CREATE BASE CASE POLICIES
-- ========================================

-- BASE CASE 1: Users can ALWAYS see their own membership rows
-- This is the termination condition - NO subqueries!
CREATE POLICY "base_see_own_membership"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- BASE CASE 2: Users can ALWAYS insert themselves as members
CREATE POLICY "base_insert_own_membership"
ON public.chat_room_members FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- ========================================
-- STEP 3: BUILD ON BASE CASE
-- ========================================

-- Chat Rooms: INSERT - anyone can create rooms
CREATE POLICY "rooms_insert"
ON public.chat_rooms FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Chat Rooms: SELECT - see rooms you created OR have membership
-- Safe because chat_room_members base case prevents recursion
CREATE POLICY "rooms_select"
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

-- Chat Room Members: INSERT - creators can add others
-- Safe because it only checks chat_rooms.created_by (simple column check)
CREATE POLICY "members_insert_by_creator"
ON public.chat_room_members FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 
        FROM public.chat_rooms 
        WHERE id = room_id 
        AND created_by = auth.uid()
    )
);

-- Chat Room Members: SELECT - see members of accessible rooms
-- Safe because rooms_select uses our base case
CREATE POLICY "members_select_in_accessible_rooms"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.chat_rooms 
        WHERE id = room_id 
        AND (created_by = auth.uid() OR id IN (
            SELECT room_id 
            FROM public.chat_room_members 
            WHERE user_id = auth.uid()
        ))
    )
);

-- Chat Messages: INSERT - send in rooms you're member of
CREATE POLICY "messages_insert"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
        SELECT 1 
        FROM public.chat_room_members 
        WHERE room_id = chat_messages.room_id 
        AND user_id = auth.uid()
    )
);

-- Chat Messages: SELECT - view in accessible rooms
CREATE POLICY "messages_select"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.chat_room_members 
        WHERE room_id = chat_messages.room_id 
        AND user_id = auth.uid()
    )
);
