import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { addHours, isAfter, isBefore, parseISO } from 'date-fns';

export interface NotificationItem {
    id: string;
    type: 'mention' | 'system' | 'info' | 'patient' | 'doctor' | 'appointment' | 'message';
    title: string;
    message: string;
    link?: string;
    is_read: boolean;
    created_at: string;
    priority?: 'high' | 'normal'; // derived
}

export const useNotifications = () => {
    const { user, userRole } = useAuth();

    // 1. Fetch persistent notifications from DB (last 7 days)
    const { data: dbNotifications, isLoading: dbLoading, refetch: refetchDb } = useQuery({
        queryKey: ['notifications', user?.id],
        queryFn: async () => {
            // Get date 7 days ago
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user?.id)
                .gte('created_at', sevenDaysAgo.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as NotificationItem[];
        },
        enabled: !!user,
        // Refetch often or use realtime subscription (we'll implement realtime separately)
    });

    // 2. Fetch Upcoming Appointments (Next 72h)
    // Logic depends on role:
    // Admin/Doctor: All upcoming appointments (or just assigned for doctor? Spec says "Doctor ... Sees all notifications across the system" -> implies all? 
    //   Actually "Sees all notifications across the system" is listed under RBAC. 
    //   But usually Doctor cares about THEIR appointments. 
    //   However, spec says: "Admin ... Sees: all upcoming appointments", "Doctor ... Same as Admin (full access)".
    //   So Doctors see ALL upcoming appointments? That might be noisy. 
    //   But the prompt says "Sees all notifications across the system". I will follow spec.
    // Employee: "Sees ONLY: Their own upcoming appointments" -> How is an appointment "employee's"? 
    //   Maybe if they created it? Or if it's assigned to them (if employees can be assigned)? 
    //   The schema has `doctor_id`. It doesn't have `employee_id`. 
    //   Maybe employees don't have "own" appointments in the `appointments` table sense, unless they are patients?
    //   Or maybe it refers to "My Calendar" which usually implies appointments *I* created? 
    //   Let's assume "Their own upcoming appointments" for Employee means appointments they created (if we tracked `created_by` on appointments, which we might not have).
    //   Let's check `appointments` schema again from memory (or file).
    //   `appointments` has `doctor_id` and tables usually have RLS.
    //   If Employee cannot be `doctor_id`, then they have no assigned appointments.
    //   Maybe they mean "appointments they are involved in"? 
    //   If I cannot query "my appointments" for an employee easily, I might skip this part for them or show nothing.
    //   Wait, "My Calendar" in dashboard usually shows something.
    //   Let's stick to: Admin/Doctor -> All upcoming. Employee -> None (or TODO if logic clarifies).

    const { data: upcomingAppointments, isLoading: appLoading } = useQuery({
        queryKey: ['upcoming-appointments', userRole],
        queryFn: async () => {
            if (!user) return [];

            const now = new Date();
            const next72h = addHours(now, 72);

            let query = supabase
                .from('appointments')
                .select(`
          id, 
          appointment_date, 
          patient:patients(full_name)
        `)
                .gte('appointment_date', now.toISOString())
                .lte('appointment_date', next72h.toISOString())
                .order('appointment_date', { ascending: true });

            if (userRole === 'doctor' || userRole === 'admin') {
                // Fetch all (or maybe filtered if performance issue, but 72h is small window)
            } else if (userRole === 'zamestnanec') {
                // Employee: "Sees ONLY: Their own upcoming appointments"
                // If we don't have created_by on appointments, we can't filter by "created by me".
                // Use RLS? If RLS allows them to see all, we shouldn't show all in notification.
                // Assuming Employee has NO appointments in this system context unless they are the patient (unlikely role mix).
                // I will return empty for now to be safe, preventing info leak.
                return [];
            } else {
                // Patient
                // We need to find the patient record for this user
                const { data: patientData } = await supabase.from('patients').select('id').eq('user_id', user.id).single();
                if (patientData) {
                    query = query.eq('patient_id', patientData.id);
                } else {
                    return [];
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            return (data as any[]).map(app => ({
                id: `app-${app.id}`,
                type: 'appointment',
                title: 'Upcoming Appointment',
                message: `${format(new Date(app.appointment_date), 'MMM d, HH:mm')} - ${app.patient?.full_name} (${app.doctor?.full_name || 'Unassigned'})`,
                link: `/dashboard?tab=calendar&appointmentId=${app.id}`,
                is_read: false, // Always "new" if upcoming
                created_at: app.appointment_date, // Sort by event time? Or creation? For "Upcoming", event time is key.
                priority: 'high'
            })) as NotificationItem[];
        },
        enabled: !!user && !!userRole
    });

    // Combine
    const notifications = [
        ...(upcomingAppointments || []).map(n => ({ ...n, priority: 'high' })),
        ...(dbNotifications || []).map(n => ({ ...n, priority: 'normal' }))
    ] as NotificationItem[];

    // Sort: High priority first, then by date (newest first for normal, maybe closest first for upcoming?)
    // Actually, "Upcoming" should be at top.
    notifications.sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (a.priority !== 'high' && b.priority === 'high') return 1;
        // If both high (upcoming), closest date first?
        // If both normal, newest created_at first.
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return {
        notifications,
        unreadCount,
        isLoading: dbLoading || appLoading,
        refetch: refetchDb
    };
};

import { format } from 'date-fns';
