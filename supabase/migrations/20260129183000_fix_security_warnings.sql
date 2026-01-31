-- Fix Function Search Path Mutable warnings by explicitly setting search_path
-- This prevents malicious code from overriding behavior by creating objects in other schemas

-- 1. Fix handle_chat_mentions
CREATE OR REPLACE FUNCTION public.handle_chat_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 2. Fix auth_is_admin
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'::public.app_role
  );
$$;

-- 3. Fix create_notification
CREATE OR REPLACE FUNCTION public.create_notification(
    _user_id UUID,
    _type TEXT,
    _title TEXT,
    _message TEXT,
    _link TEXT DEFAULT NULL,
    _appointment_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, link, appointment_id)
    VALUES (_user_id, _type, _title, _message, _link, _appointment_id)
    RETURNING id INTO _notification_id;
    RETURN _notification_id;
END;
$$;

-- 4. Fix notify_on_new_patient
CREATE OR REPLACE FUNCTION public.notify_on_new_patient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _admin_id UUID;
    _doctor_id UUID;
    _creator_id UUID;
BEGIN
    -- 1. Notify Admins
    FOR _admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
        IF _admin_id != auth.uid() THEN 
            PERFORM public.create_notification(
                _admin_id,
                'patient',
                'New Patient Registered',
                'New patient registered: ' || NEW.full_name,
                '/patients'
            );
        END IF;
    END LOOP;

    -- 2. Notify Doctors
    FOR _doctor_id IN SELECT user_id FROM public.user_roles WHERE role = 'doctor' LOOP
        IF _doctor_id != auth.uid() THEN
            PERFORM public.create_notification(
                _doctor_id,
                'patient',
                'New Patient Registered',
                'New patient registered: ' || NEW.full_name,
                '/patients'
            );
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;

-- 5. Fix potentially missing functions if they exist (without arguments assumption)
-- Commented out to avoid errors if they don't exist or have arguments, uncomment if needed or run manually in dashboard
-- ALTER FUNCTION public.increment_map_cache_use() SET search_path = public;
-- ALTER FUNCTION public.handle_updated_at() SET search_path = public;

