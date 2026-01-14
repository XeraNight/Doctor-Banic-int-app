-- Redefine handle_new_user function to respect the role provided in user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  meta_role text;
  fullname text;
BEGIN
  -- Get role and full name from metadata
  meta_role := NEW.raw_user_meta_data->>'role';
  fullname := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  -- Create public profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    fullname
  );
  
  -- Logic for role assignment
  -- Priority 1: Specific email (Project Owner/Admin)
  IF NEW.email = 'jakubkalina05@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');

  -- Priority 2: Use role from metadata if valid
  ELSIF meta_role IS NOT NULL AND meta_role IN ('admin', 'doctor', 'zamestnanec', 'patient') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, meta_role::public.app_role);

    -- Only create patient record if the role is actually 'patient'
    IF meta_role = 'patient' THEN
      INSERT INTO public.patients (user_id, full_name, email)
      VALUES (
        NEW.id,
        fullname,
        NEW.email
      );
    END IF;

  -- Priority 3: Fallback default (patient)
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient');
    
    INSERT INTO public.patients (user_id, full_name, email)
    VALUES (
      NEW.id,
      fullname,
      NEW.email
    );
  END IF;
  
  RETURN NEW;
END;
$$;
