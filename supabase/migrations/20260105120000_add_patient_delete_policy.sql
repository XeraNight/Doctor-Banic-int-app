-- Add DELETE policy for patients table
-- Allows admins and doctors to delete patients

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Admins and doctors can delete patients" ON public.patients;

-- Create DELETE policy
CREATE POLICY "Admins and doctors can delete patients" 
ON public.patients 
FOR DELETE 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
);
