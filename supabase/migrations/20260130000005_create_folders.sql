-- Create folders table
CREATE TABLE public.folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Policies for folders
-- Allow authenticated users (doctors/admins) to do everything for now
CREATE POLICY "Authenticated users can select folders" ON public.folders
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert folders" ON public.folders
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update folders" ON public.folders
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete folders" ON public.folders
    FOR DELETE USING (auth.role() = 'authenticated');

-- Add folder_id to documents
ALTER TABLE public.documents 
ADD COLUMN folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL;
