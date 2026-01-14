import pkg from '@supabase/supabase-js';
import 'dotenv/config';

const { createClient } = pkg;

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing from .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkNotifications() {
    // Query notifications directly with service_role (bypasses RLS)
    const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log('=== ALL NOTIFICATIONS (bypassing RLS) ===');
    if (notifError) {
        console.error('Error fetching notifications:', notifError);
    } else {
        console.log(`Found ${notifications?.length || 0} notifications:`);
        console.table(notifications);
    }

    // Check user_roles
    const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'doctor']);

    console.log('\n=== USER ROLES ===');
    if (rolesError) {
        console.error('Error fetching user roles:', rolesError);
    } else {
        console.log(`Found ${userRoles?.length || 0} admin/doctor users:`);
        console.table(userRoles);
    }

    // Check recent patients
    const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id, full_name, created_at, created_by')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n=== RECENT PATIENTS ===');
    if (patientsError) {
        console.error('Error fetching patients:', patientsError);
    } else {
        console.log(`Found ${patients?.length || 0} recent patients:`);
        console.table(patients);
    }
}

checkNotifications();
