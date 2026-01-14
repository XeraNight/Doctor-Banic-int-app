-- Allow doctors to view all user roles
-- This is required for the UserManagement component LEFT JOIN query

DROP POLICY IF EXISTS "Doctors can view all roles" ON public.user_roles;

CREATE POLICY "Doctors can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor'::app_role)
);
