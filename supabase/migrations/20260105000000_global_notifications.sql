-- Add created_by column to patients table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'created_by') THEN
        ALTER TABLE public.patients ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Enable RLS logic for notifications if not already robust
-- (Already handled in previous migrations, but ensuring we have helpful functions)

-- Function to create notification
CREATE OR REPLACE FUNCTION public.create_notification(
    _user_id UUID,
    _type TEXT,
    _title TEXT,
    _message TEXT,
    _link TEXT DEFAULT NULL,
    _appointment_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _notification_id UUID;
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, link, appointment_id)
    VALUES (_user_id, _type, _title, _message, _link, _appointment_id)
    RETURNING id INTO _notification_id;
    RETURN _notification_id;
END;
$$;

-- Trigger: Notify on New Patient
CREATE OR REPLACE FUNCTION public.notify_on_new_patient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _admin_id UUID;
    _doctor_id UUID;
    _creator_id UUID;
BEGIN
    -- 1. Notify Admins
    FOR _admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
        -- Don't notify if admin created it (optional, but good UX to verify action) -> actually user wants to see it maybe? 
        -- Rule: "Admin ... Sees: all new patients".
        -- Let's notify everyone appropriate regardless of who created it, or maybe exclude self if desired. 
        -- Sticking to spec: "Admin ... Sees: all new patients". 
        -- If I create it, I might not need a notification, but it keeps history consistent.
        -- Let's exclude creator from receiving "New Patient" notification to reduce noise, unless they want it.
        -- Actually, for simplicity and ensuring "See all", I will include all.
        -- Wait, if I am the admin who created it, I don't need a notification telling me I did it.
        IF _admin_id != auth.uid() THEN 
            PERFORM public.create_notification(
                _admin_id,
                'patient',
                'New Patient Registered',
                'New patient registered: ' || NEW.full_name,
                '/patients'
            );
        END IF;
    END LOOP;

    -- 2. Notify Doctors
    FOR _doctor_id IN SELECT user_id FROM public.user_roles WHERE role = 'doctor' LOOP
        IF _doctor_id != auth.uid() THEN
            PERFORM public.create_notification(
                _doctor_id,
                'patient',
                'New Patient Registered',
                'New patient registered: ' || NEW.full_name,
                '/patients'
            );
        END IF;
    END LOOP;

    -- 3. Notify Creator (if Employee)
    -- "Employee ... Sees ONLY: Their own new patients" -> This means they see the patient in the list.
    -- Do they need a notification? "Notifications included ... New patients".
    -- If they created it, they know. But maybe it came from a system import?
    -- If 'created_by' is set, and that user is an employee, they might want to know if it wasn't them interacting right now (async).
    -- But usually 'created_by' implies they did it. 
    -- However, the requirement says "Sees ONLY: Their own new patients".
    -- I will assume this refers to the *list* access mostly, but for notifications, if an employee created a patient, they probably don't need a bell ring.
    -- BUT, if a patient registers themselves (if that's possible? currently creates profile/patient), the trigger might handle it.
    -- Current flow: Admin/Doctor/Employee creates patient manually.
    -- So no notification needed for creator.

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_patient_created ON public.patients;
CREATE TRIGGER on_patient_created
AFTER INSERT ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_patient();

-- Trigger: Notify on New Doctor (User Role Change or New User with Role)
-- "Notifications included ... New doctors"
-- We can track this on user_roles table insert.

CREATE OR REPLACE FUNCTION public.notify_on_new_doctor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _admin_id UUID;
    _profile_name TEXT;
BEGIN
    IF NEW.role = 'doctor' THEN
        SELECT full_name INTO _profile_name FROM public.profiles WHERE id = NEW.user_id;
        
        -- Notify Admins
        FOR _admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
            -- Exclude self if admin made themselves a doctor (unlikely but possible)
            IF _admin_id != auth.uid() THEN
                 PERFORM public.create_notification(
                    _admin_id,
                    'doctor',
                    'New Doctor Joined',
                    'New doctor registered: ' || COALESCE(_profile_name, 'Unknown'),
                    '/doctors'
                );
            END IF;
        END LOOP;
        
        -- Doctors also see "all doctors"? "Doctor ... Sees all notifications across the system" -> Yes.
         FOR _admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'doctor' LOOP
            IF _admin_id != NEW.user_id THEN -- Don't notify the new doctor about themselves
                 PERFORM public.create_notification(
                    _admin_id,
                    'doctor',
                    'New Doctor Joined',
                    'New doctor joined the team: ' || COALESCE(_profile_name, 'Unknown'),
                    '/doctors'
                );
            END IF;
        END LOOP;
        
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_doctor_role_assigned ON public.user_roles;
CREATE TRIGGER on_doctor_role_assigned
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_doctor();


-- Trigger: Notify on New Appointment
CREATE OR REPLACE FUNCTION public.notify_on_new_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _admin_id UUID;
    _doctor_id UUID;
    _patient_name TEXT;
    _doctor_name TEXT;
BEGIN
    SELECT full_name INTO _patient_name FROM public.patients WHERE id = NEW.patient_id;
    
    -- Notify Admins
    FOR _admin_id IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
        IF _admin_id != auth.uid() THEN
            PERFORM public.create_notification(
                _admin_id,
                'appointment',
                'New Appointment',
                'New appointment for ' || _patient_name,
                '/calendar',
                NEW.id
            );
        END IF;
    END LOOP;

    -- Notify Assigned Doctor (if exists)
    IF NEW.doctor_id IS NOT NULL THEN
        -- Check if doctor is not the one creating it
        IF NEW.doctor_id != auth.uid() THEN
             PERFORM public.create_notification(
                NEW.doctor_id,
                'appointment',
                'New Appointment',
                'You have a new appointment with ' || _patient_name,
                '/calendar',
                NEW.id
            );
        END IF;
    END IF;
    
    -- Notify Patient? (If patient has a user account linked)
    -- Patients table has user_id.
    DECLARE
        _patient_user_id UUID;
    BEGIN
        SELECT user_id INTO _patient_user_id FROM public.patients WHERE id = NEW.patient_id;
        IF _patient_user_id IS NOT NULL AND _patient_user_id != auth.uid() THEN
             PERFORM public.create_notification(
                _patient_user_id,
                'appointment',
                'New Appointment',
                'Your appointment has been scheduled.',
                '/dashboard', -- Patient dashboard
                NEW.id
            );
        END IF;
    END;

    -- Notify Employee? 
    -- "Employee ... Sees ONLY: Their own upcoming appointments".
    -- If an employee created it, or is involved? 
    -- Appointments don't explicitly link to 'Employee' owner other than creator.
    -- If employee created it, they know.
    -- So mostly Admin/Doctor notifications here.

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_appointment_created ON public.appointments;
CREATE TRIGGER on_appointment_created
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_appointment();
