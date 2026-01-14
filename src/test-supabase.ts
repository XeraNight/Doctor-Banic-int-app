// Test file to check Supabase configuration
console.log('=== SUPABASE CONFIG TEST ===');
console.log('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? 'LOADED' : 'MISSING');
console.log('===========================');

import { supabase } from '@/integrations/supabase/client';

// Test connection
supabase.auth.getSession()
    .then(({ data, error }) => {
        console.log('Supabase connection test:');
        console.log('Success:', !error);
        if (error) {
            console.error('Error:', error);
        } else {
            console.log('Session data:', data);
        }
    })
    .catch((err) => {
        console.error('Failed to fetch session:', err);
    });

export { };
