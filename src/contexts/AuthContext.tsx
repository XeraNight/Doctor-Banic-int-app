import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: 'admin' | 'doctor' | 'patient' | 'zamestnanec' | null;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, captchaToken?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'doctor' | 'patient' | 'zamestnanec' | null>(null);
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        setUserRole(data[0].role as 'admin' | 'doctor' | 'patient' | 'zamestnanec');
      } else {
        setUserRole(null);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Set up auth state listener first (sync callback - no async!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer Supabase call with setTimeout to prevent deadlock
          setTimeout(() => {
            if (isMounted) {
              fetchUserRole(session.user.id);
            }
          }, 0);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken }
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, captchaToken?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        captchaToken,
        data: {
          full_name: fullName,
        }
      }
    });

    // Profile and role are automatically created by database trigger
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
