-- Allow authenticated users to create their own patient profile
-- This is necessary for self-healing if the trigger fails or for manual cleanups
CREATE POLICY "Users can create their own patient profile"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
