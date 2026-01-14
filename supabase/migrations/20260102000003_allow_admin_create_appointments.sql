-- Allow admins to create appointments by updating the validation trigger
CREATE OR REPLACE FUNCTION public.validate_appointment_doctor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only validate if doctor_id is provided
  IF NEW.doctor_id IS NOT NULL THEN
    -- Check if doctor_id has doctor OR admin role
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.doctor_id 
      AND role IN ('doctor', 'admin')
    ) THEN
      RAISE EXCEPTION 'Invalid doctor_id: user does not have doctor or admin role';
    END IF;
  END IF;
  
  -- Validate appointment is in the future (only for new appointments)
  IF TG_OP = 'INSERT' AND NEW.appointment_date <= now() THEN
    RAISE EXCEPTION 'Appointment date must be in the future';
  END IF;
  
  RETURN NEW;
END;
$$;
