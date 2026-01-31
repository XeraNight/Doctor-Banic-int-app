-- Add created_by column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Update existing appointments to have a created_by (optional, maybe set to doctor_id or leave null)
-- For now we leave it null as per plan.

-- Policy updates might be valid, but "authenticated" policies usually cover new columns if they are "select *" 
-- However, we might want to ensure employees can view their own created appointments if they aren't the doctor.
-- The existing policy "Doctors and admins can manage appointments" covers those roles.
-- We might need a policy for "Employees can view appointments they created".

CREATE POLICY "Employees can view own created appointments" 
ON public.appointments 
FOR SELECT 
TO authenticated 
USING (created_by = auth.uid());

CREATE POLICY "Employees can update own created appointments" 
ON public.appointments 
FOR UPDATE
TO authenticated 
USING (created_by = auth.uid());

CREATE POLICY "Employees can delete own created appointments" 
ON public.appointments 
FOR DELETE
TO authenticated 
USING (created_by = auth.uid());
