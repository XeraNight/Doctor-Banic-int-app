-- FINAL FIX for chat_room_members infinite recursion
-- The issue was that checking "am I a member" inside the chat_room_members policy caused a loop.
-- Solution: Use a SECURITY DEFINER function to bypass RLS for the membership check.

-- ========================================
-- STEP 1: Create Secure Function (Bypasses RLS)
-- ========================================
CREATE OR REPLACE FUNCTION public.auth_is_member_of_room(_room_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER -- Critical: Runs with owner privileges, bypassing RLS
SET search_path = public -- Security best practice
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.chat_room_members 
        WHERE room_id = _room_id 
        AND user_id = auth.uid()
    );
$$;

-- ========================================
-- STEP 2: Drop Recursive Policies
-- ========================================
DROP POLICY IF EXISTS "members_select_in_accessible_rooms" ON public.chat_room_members;
DROP POLICY IF EXISTS "rooms_select" ON public.chat_rooms;
-- We keep "base_see_own_membership" etc. as they remain valid and useful

-- ========================================
-- STEP 3: Recreate Policies using Secure Function
-- ========================================

-- Chat Room Members: SELECT -> See members if I am a member (or created the room)
CREATE POLICY "members_select_final"
ON public.chat_room_members FOR SELECT
TO authenticated
USING (
    user_id = auth.uid() -- Base case: see myself
    OR
    public.auth_is_member_of_room(room_id) -- Use secure function to check membership
    OR
    EXISTS ( -- Or if I created the room
        SELECT 1 
        FROM public.chat_rooms 
        WHERE id = room_id 
        AND created_by = auth.uid()
    )
);

-- Chat Rooms: SELECT -> See rooms if created by me OR I am a member
CREATE POLICY "rooms_select_final"
ON public.chat_rooms FOR SELECT
TO authenticated
USING (
    created_by = auth.uid() 
    OR 
    public.auth_is_member_of_room(id) -- Use secure function here too
);

-- ========================================
-- STEP 4: Ensure other policies line up
-- ========================================

-- Re-apply message policies to use function for consistency (optional but cleaner)
DROP POLICY IF EXISTS "messages_insert" ON public.chat_messages;
DROP POLICY IF EXISTS "messages_select" ON public.chat_messages;

CREATE POLICY "messages_insert_final"
ON public.chat_messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = auth.uid() AND
    public.auth_is_member_of_room(room_id)
);

CREATE POLICY "messages_select_final"
ON public.chat_messages FOR SELECT
TO authenticated
USING (
    public.auth_is_member_of_room(room_id)
);
