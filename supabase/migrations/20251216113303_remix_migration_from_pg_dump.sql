CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
        CREATE TYPE public.app_role AS ENUM (
            'admin',
            'doctor',
            'patient',
            'zamestnanec'
        );
    END IF;
END$$;


--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE public.appointment_status AS ENUM (
            'pending',
            'confirmed',
            'completed',
            'cancelled',
            'no_show'
        );
    END IF;
END$$;


--
-- Name: appointment_type; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_type') THEN
        CREATE TYPE public.appointment_type AS ENUM (
            'consultation',
            'control',
            'cardiology',
            'internal',
            'emergency',
            'other'
        );
    END IF;
END$$;


--
-- Name: note_category; Type: TYPE; Schema: public; Owner: -
--

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'note_category') THEN
        CREATE TYPE public.note_category AS ENUM (
            'administrative',
            'medical',
            'reminder'
        );
    END IF;
END$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Assign admin role for specific email, patient role for others
  IF NEW.email = 'jakubkalina05@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'patient');
    
    -- Also create a patient record for non-admin users
    INSERT INTO public.patients (user_id, full_name, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      NEW.email
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;


CREATE OR REPLACE FUNCTION public.is_member_of_room(_room_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_room_members
    WHERE room_id = _room_id
    AND user_id = auth.uid()
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: validate_appointment_doctor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION public.validate_appointment_doctor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only validate if doctor_id is provided
  IF NEW.doctor_id IS NOT NULL THEN
    -- Check if doctor_id has doctor role
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.doctor_id AND role = 'doctor'
    ) THEN
      RAISE EXCEPTION 'Invalid doctor_id: user does not have doctor role';
    END IF;
  END IF;
  
  -- Validate appointment is in the future (only for new appointments)
  IF TG_OP = 'INSERT' AND NEW.appointment_date <= now() THEN
    RAISE EXCEPTION 'Appointment date must be in the future';
  END IF;
  
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    doctor_id uuid,
    appointment_date timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 30,
    appointment_type public.appointment_type NOT NULL,
    reason text,
    status public.appointment_status DEFAULT 'pending'::public.appointment_status,
    room text,
    medical_notes text,
    is_team_calendar boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    target_table text,
    target_id uuid,
    details jsonb,
    "timestamp" timestamp with time zone DEFAULT now()
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_room_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_room_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    room_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    is_team_chat boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid NOT NULL
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    patient_id uuid NOT NULL,
    appointment_id uuid,
    uploaded_by uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size integer,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: imported_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imported_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_path text NOT NULL,
    file_name text NOT NULL,
    file_type text,
    is_route boolean DEFAULT false,
    route_path text,
    content_preview text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: imported_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imported_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT imported_projects_category_check CHECK ((category = ANY (ARRAY['school'::text, 'work'::text, 'free_time'::text])))
);


--
-- Name: notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    category public.note_category NOT NULL,
    note_date date,
    appointment_id uuid,
    is_draft boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    is_read boolean DEFAULT false,
    appointment_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text,
    date_of_birth date,
    insurance_company text,
    address text,
    emergency_contact text,
    emergency_phone text,
    medical_history text,
    allergies text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    phone text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_room_members chat_room_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_room_members
    ADD CONSTRAINT chat_room_members_pkey PRIMARY KEY (id);


--
-- Name: chat_room_members chat_room_members_room_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_room_members
    ADD CONSTRAINT chat_room_members_room_id_user_id_key UNIQUE (room_id, user_id);


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: imported_files imported_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_files
    ADD CONSTRAINT imported_files_pkey PRIMARY KEY (id);


--
-- Name: imported_projects imported_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_projects
    ADD CONSTRAINT imported_projects_pkey PRIMARY KEY (id);


--
-- Name: notes notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: appointments update_appointments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: imported_projects update_imported_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_imported_projects_updated_at BEFORE UPDATE ON public.imported_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: notes update_notes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: patients update_patients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: appointments validate_appointment_doctor_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER validate_appointment_doctor_trigger BEFORE INSERT OR UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_doctor();


--
-- Name: appointments appointments_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES auth.users(id);


--
-- Name: appointments appointments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_room_members chat_room_members_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_room_members
    ADD CONSTRAINT chat_room_members_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: documents documents_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: documents documents_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: documents documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);


--
-- Name: imported_files imported_files_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imported_files
    ADD CONSTRAINT imported_files_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.imported_projects(id) ON DELETE CASCADE;


--
-- Name: notes notes_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: notes notes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notes
    ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: patients patients_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: documents Admins and doctors can delete documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and doctors can delete documents" ON public.documents FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));


--
-- Name: patients Admins and doctors can insert patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and doctors can insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));


--
-- Name: patients Admins and doctors can update patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and doctors can update patients" ON public.patients FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));


--
-- Name: patients Admins and doctors can view all patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and doctors can view all patients" ON public.patients FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));


--
-- Name: profiles Admins and doctors can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins and doctors can view all profiles" ON public.profiles FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));


--
-- Name: imported_files Admins can view all imported files; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all imported files" ON public.imported_files FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: imported_projects Admins can view all imported projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all imported projects" ON public.imported_projects FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: notes Admins can view all notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all notes" ON public.notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: user_roles Admins can view all roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: audit_log Admins can view audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view audit logs" ON public.audit_log FOR SELECT USING (public.has_role(auth.uid(), 'admin'::public.app_role));


--
-- Name: chat_rooms Authenticated users can create chat rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create chat rooms" ON public.chat_rooms FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: appointments Doctors and admins can manage appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and admins can manage appointments" ON public.appointments TO authenticated USING ((public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: documents Doctors and admins can upload documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and admins can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: documents Doctors and admins can view all documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors and admins can view all documents" ON public.documents FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: appointments Doctors can view their appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Doctors can view their appointments" ON public.appointments FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'doctor'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: appointments Employees can manage appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can manage appointments" ON public.appointments USING ((public.has_role(auth.uid(), 'zamestnanec'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))) WITH CHECK ((public.has_role(auth.uid(), 'zamestnanec'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role)));


--
-- Name: patients Employees can view patients; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view patients" ON public.patients FOR SELECT USING ((public.has_role(auth.uid(), 'zamestnanec'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'doctor'::public.app_role)));


--
-- Name: profiles Employees can view profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Employees can view profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'zamestnanec'::public.app_role));


--
-- Name: appointments Patients can cancel their appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can cancel their appointments" ON public.appointments FOR UPDATE TO authenticated USING (((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_id = auth.uid()))) AND (status = 'pending'::public.appointment_status))) WITH CHECK ((status = 'cancelled'::public.appointment_status));


--
-- Name: appointments Patients can insert appointment requests; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can insert appointment requests" ON public.appointments FOR INSERT TO authenticated WITH CHECK ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_id = auth.uid()))));


--
-- Name: documents Patients can upload documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can upload documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_id = auth.uid()))) AND (uploaded_by = auth.uid())));


--
-- Name: appointments Patients can view their own appointments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view their own appointments" ON public.appointments FOR SELECT TO authenticated USING ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_id = auth.uid()))));


--
-- Name: documents Patients can view their own documents; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view their own documents" ON public.documents FOR SELECT TO authenticated USING ((patient_id IN ( SELECT patients.id
   FROM public.patients
  WHERE (patients.user_id = auth.uid()))));


--
-- Name: patients Patients can view their own record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Patients can view their own record" ON public.patients FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_room_members Users can add members to their rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can add members to their rooms" ON public.chat_room_members FOR INSERT WITH CHECK (((room_id IN ( SELECT chat_rooms.id
   FROM public.chat_rooms
  WHERE (chat_rooms.created_by = auth.uid()))) OR (user_id = auth.uid())));


--
-- Name: imported_files Users can create files in their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create files in their own projects" ON public.imported_files FOR INSERT TO authenticated WITH CHECK ((project_id IN ( SELECT imported_projects.id
   FROM public.imported_projects
  WHERE (imported_projects.user_id = auth.uid()))));


--
-- Name: notifications Users can create notifications for themselves; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create notifications for themselves" ON public.notifications FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: imported_projects Users can create their own imported projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own imported projects" ON public.imported_projects FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: imported_files Users can delete files from their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete files from their own projects" ON public.imported_files FOR DELETE TO authenticated USING ((project_id IN ( SELECT imported_projects.id
   FROM public.imported_projects
  WHERE (imported_projects.user_id = auth.uid()))));


--
-- Name: imported_projects Users can delete their own imported projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete their own imported projects" ON public.imported_projects FOR DELETE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: audit_log Users can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert audit logs" ON public.audit_log FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: chat_room_members Users can leave rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can leave rooms" ON public.chat_room_members FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: notes Users can manage their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own notes" ON public.notes TO authenticated USING ((auth.uid() = user_id));


--
-- Name: chat_messages Users can send messages to their rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages to their rooms" ON public.chat_messages FOR INSERT WITH CHECK (((sender_id = auth.uid()) AND (room_id IN ( SELECT chat_room_members.room_id
   FROM public.chat_room_members
  WHERE (chat_room_members.user_id = auth.uid())))));


--
-- Name: imported_projects Users can update their own imported projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own imported projects" ON public.imported_projects FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: imported_files Users can view files of their own projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view files of their own projects" ON public.imported_files FOR SELECT TO authenticated USING ((project_id IN ( SELECT imported_projects.id
   FROM public.imported_projects
  WHERE (imported_projects.user_id = auth.uid()))));


--
-- Name: chat_messages Users can view messages in their rooms; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view messages in their rooms" ON public.chat_messages FOR SELECT USING (public.is_member_of_room(room_id));


--
-- Name: chat_room_members Users can view room members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view room members" ON public.chat_room_members FOR SELECT USING (public.is_member_of_room(room_id));


--
-- Name: chat_rooms Users can view rooms they are members of; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view rooms they are members of" ON public.chat_rooms FOR SELECT USING (public.is_member_of_room(id) OR created_by = auth.uid());


--
-- Name: imported_projects Users can view their own imported projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own imported projects" ON public.imported_projects FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notes Users can view their own notes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: user_roles Users can view their own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: appointments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_room_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_room_members ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_rooms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: imported_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imported_files ENABLE ROW LEVEL SECURITY;

--
-- Name: imported_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.imported_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: patients; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


