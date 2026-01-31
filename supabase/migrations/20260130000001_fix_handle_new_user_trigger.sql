CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check for manual creation flag in user metadata
  -- If present, skip automatic profile/role creation as it will be handled by the calling function
  IF (NEW.raw_user_meta_data->>'is_manual_creation')::boolean = true THEN
    RETURN NEW;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assign admin role for specific email, patient role for others
  IF NEW.email = 'jakubkalina05@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient');
    
    -- Also create a patient record for non-admin users
    INSERT INTO public.patients (user_id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email
    );
  END IF;
  
  RETURN NEW;
END;
$$;
