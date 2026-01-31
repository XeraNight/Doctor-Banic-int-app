-- Function to safely create a patient profile for the current user
-- Uses SECURITY DEFINER to bypass RLS restrictions on the patients table insert
CREATE OR REPLACE FUNCTION create_my_patient_profile(full_name text, email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_patient json;
  current_user_id uuid;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check if already exists
  SELECT row_to_json(p) INTO new_patient
  FROM patients p
  WHERE p.user_id = current_user_id;

  IF new_patient IS NOT NULL THEN
    RETURN new_patient;
  END IF;

  -- Insert new patient
  INSERT INTO patients (user_id, full_name, email, created_at)
  VALUES (current_user_id, full_name, email, now())
  RETURNING row_to_json(patients.*) INTO new_patient;

  RETURN new_patient;
END;
$$;
