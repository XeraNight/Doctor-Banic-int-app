-- Create a simple trigger for patient notifications
CREATE OR REPLACE FUNCTION public.notify_on_new_patient_simple()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _user_id UUID;
BEGIN
    -- Notify all admins and doctors about new patient
    FOR _user_id IN 
        SELECT DISTINCT user_id 
        FROM public.user_roles 
        WHERE role IN ('admin', 'doctor')
        AND user_id != COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
        INSERT INTO public.notifications (user_id, type, title, message, link, is_read)
        VALUES (
            _user_id,
            'patient',
            'Nový pacient',
            'Pridaný nový pacient: ' || NEW.full_name,
            '/dashboard',
            false
        );
    END LOOP;

    RETURN NEW;
END;
$$;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS on_patient_created_simple ON public.patients;
CREATE TRIGGER on_patient_created_simple
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_patient_simple();
