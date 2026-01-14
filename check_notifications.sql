-- Check if any notifications were created
SELECT * FROM public.notifications ORDER BY created_at DESC LIMIT 10;

-- Check if the trigger function exists
SELECT proname, prosrc FROM pg_proc WHERE proname = 'notify_on_new_patient_simple';

-- Check if the trigger exists
SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgname = 'on_patient_created_simple';
