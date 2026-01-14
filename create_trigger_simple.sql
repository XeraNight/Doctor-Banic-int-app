-- Fixed notification trigger for new patients
-- Removed 'link' column which doesn't exist in notifications table

-- Function to create notification (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_notification(
    _user_id UUID,
    _type TEXT,
    _title TEXT,
    _message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (_user_id, _type, _title, _message)
    RETURNING id INTO _notification_id;
    RETURN _notification_id;
END;
$$;

-- Trigger function for new patients
CREATE OR REPLACE FUNCTION public.notify_on_new_patient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _admin_id UUID;
    _doctor_id UUID;
BEGIN
    -- Notify all admins
    FOR _admin_id IN 
        SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
        PERFORM public.create_notification(
            _admin_id,
            'patient',
            'Nový pacient',
            'Bol zaregistrovaný nový pacient: ' || NEW.full_name
        );
    END LOOP;

    -- Notify all doctors
    FOR _doctor_id IN 
        SELECT user_id FROM public.user_roles WHERE role = 'doctor'
    LOOP
        PERFORM public.create_notification(
            _doctor_id,
            'patient',
            'Nový pacient',
            'Bol zaregistrovaný nový pacient: ' || NEW.full_name
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_patient_created ON public.patients;

-- Create the trigger
CREATE TRIGGER on_patient_created
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_patient();
