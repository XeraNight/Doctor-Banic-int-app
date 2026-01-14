-- 1. Create Notifications Table (if not exists)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'mention', 'system', 'info'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT, -- e.g., '/chat?room=123'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Safely Drop Existing Policies
DROP POLICY IF EXISTS "Users can see their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

-- Recreate Policies
CREATE POLICY "Users can see their own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Update Chat Messages to support mentions
ALTER TABLE public.chat_messages
ADD COLUMN IF NOT EXISTS mentions UUID[] DEFAULT '{}';

-- 3. Create Function to handle new mentions
CREATE OR REPLACE FUNCTION public.handle_chat_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    mentioned_user_id UUID;
    sender_name TEXT;
    room_name TEXT;
BEGIN
    -- Only proceed if there are mentions
    IF NEW.mentions IS NOT NULL AND array_length(NEW.mentions, 1) > 0 THEN
        
        -- Get sender name
        SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
        IF sender_name IS NULL THEN sender_name := 'Unknown User'; END IF;

        -- Get room name (optional, for message context)
        SELECT name INTO room_name FROM public.chat_rooms WHERE id = NEW.room_id;

        -- Loop through mentioned users
        FOREACH mentioned_user_id IN ARRAY NEW.mentions
        LOOP
            -- Don't notify self
            IF mentioned_user_id <> NEW.sender_id THEN
                -- Insert notification regardless of duplicates for now (or could check existence)
                INSERT INTO public.notifications (user_id, type, title, message, link)
                VALUES (
                    mentioned_user_id, 
                    'mention', 
                    'New Mention', 
                    sender_name || ' mentioned you in ' || COALESCE(room_name, 'a chat'),
                    '/chat?room=' || NEW.room_id
                );
            END IF;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS on_chat_message_created ON public.chat_messages;
CREATE TRIGGER on_chat_message_created
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_chat_mentions();
