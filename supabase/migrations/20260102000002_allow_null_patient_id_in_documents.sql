-- Allow NULL values for patient_id in documents table
-- This enables creating unassigned documents that are not linked to any patient

ALTER TABLE public.documents 
ALTER COLUMN patient_id DROP NOT NULL;
