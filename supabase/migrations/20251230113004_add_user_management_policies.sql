-- Migration: Add RLS policies for user management
-- Created: 2025-12-30
-- Description: Allow admins and doctors to update profiles and user_roles

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and doctors can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and doctors can update roles" ON public.user_roles;

-- Allow users to update their own profile (for email/password self-service)
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Allow admins and doctors to update any profile (for managing other users)
CREATE POLICY "Admins and doctors can update profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
);

-- Allow admins and doctors to update user roles
CREATE POLICY "Admins and doctors can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
);

-- Allow admins and doctors to delete and insert user roles (for role changes)
CREATE POLICY "Admins and doctors can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
);

CREATE POLICY "Admins and doctors can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR 
  public.has_role(auth.uid(), 'doctor'::public.app_role)
);
