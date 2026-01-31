import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Turnstile } from '@marsidev/react-turnstile';
import logo from '@/assets/logo.png';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) {
          toast({
            title: 'Chyba',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Úspech',
            description: 'Email na obnovenie hesla bol odoslaný! Skontrolujte si schránku.',
          });
          setIsForgotPassword(false);
        }
      } else if (isLogin) {
        const { error } = await signIn(email, password, captchaToken);
        if (error) {
          toast({
            title: 'Chyba',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Úspech',
            description: 'Úspešne prihlásený',
          });
          navigate('/dashboard');
        }
      } else {
        if (!fullName || fullName.trim().length < 2) {
          toast({
            title: 'Chyba',
            description: 'Prosím zadajte svoje celé meno',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        if (!consentGiven) {
          toast({
            title: 'Chyba',
            description: 'Musíte súhlasiť so spracovaním osobných údajov',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, fullName, captchaToken);
        if (error) {
          toast({
            title: 'Chyba',
            description: error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Úspech',
            description: 'Účet bol úspešne vytvorený',
          });
          navigate('/dashboard');
        }
      }
    } catch (error: any) {
      console.error("Login error details:", error);
      toast({
        title: 'Chyba',
        description: error.message || 'Vyskytla sa chyba',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-medical-blue-light via-background to-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Doktor Baník</CardTitle>
          <CardDescription>
            {isForgotPassword ? 'Obnovenie hesla' : isLogin ? 'Prihláste sa do svojho účtu' : 'Vytvorte si nový účet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Celé meno</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Janko Hraško"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@priklad.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}
            {!isLogin && !isForgotPassword && (
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="terms" 
                  checked={consentGiven}
                  onCheckedChange={(checked) => setConsentGiven(checked as boolean)}
                />
                <Label htmlFor="terms" className="text-sm font-normal">
                  Súhlasím so{' '}
                  <a href="/#/privacy-policy" target="_blank" className="text-primary hover:underline">
                    spracovaním osobných údajov
                  </a>
                </Label>
              </div>
            )}
            
            {/* Cloudflare Turnstile CAPTCHA */}
            <div className="flex justify-center py-2">
              <Turnstile 
                siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAAA-placeholder-site-key"} 
                onSuccess={(token) => setCaptchaToken(token)}
                options={{
                  theme: 'light',
                  size: 'flexible'
                }}
              />
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0" disabled={loading}>
              {loading ? 'Spracovávam...' : isForgotPassword ? 'Odoslať email' : isLogin ? 'Prihlásiť sa' : 'Vytvoriť účet'}
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-center text-sm">
            {!isForgotPassword && (
              <>
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary hover:underline block w-full"
                >
                  {isLogin ? "Nemáte ešte účet? Zaregistrujte sa" : 'Už máte účet? Prihláste sa'}
                </button>
                {isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgotPassword(true)}
                    className="text-primary hover:underline block w-full"
                  >
                    Zabudli ste heslo?
                  </button>
                )}
              </>
            )}
            {isForgotPassword && (
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="text-primary hover:underline block w-full"
              >
                Späť na prihlásenie
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
