import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import UserManagement from '@/components/users/UserManagement';

const Settings = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newEmail || newEmail === user?.email) {
      toast({
        title: "Chyba",
        description: "Prosím zadajte inú emailovú adresu",
        variant: "destructive",
      });
      return;
    }

    setEmailLoading(true);

    const { error } = await supabase.auth.updateUser({
      email: newEmail
    });

    setEmailLoading(false);

    if (error) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Úspech",
        description: "Zmena emailu iniciovaná. Skontrolujte si nový email pre potvrdenie.",
      });
      setNewEmail('');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Chyba",
        description: "Heslá sa nezhodujú",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Chyba",
        description: "Heslo musí mať aspoň 6 znakov",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    setPasswordLoading(false);

    if (error) {
      toast({
        title: "Chyba",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Úspech",
        description: "Heslo bolo úspešne zmenené",
      });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const canManageUsers = userRole === 'admin' || userRole === 'doctor';

  return (
    <div className="min-h-screen bg-transparent p-4">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Späť na nástenku
        </Button>

        <div className={`grid gap-6 ${canManageUsers ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {/* Personal Account Settings */}
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Osobný účet</CardTitle>
              <CardDescription>
                Správa nastavení osobného účtu
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Change Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-3">Emailová adresa</h3>
                  <div className="space-y-2">
                    <Label>Súčasný email</Label>
                    <Input value={user?.email || ''} disabled />
                  </div>
                </div>

                <form onSubmit={handleEmailChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newEmail">Nový email</Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Zadajte nový email"
                    />
                  </div>
                  <Button type="submit" disabled={emailLoading} variant="outline">
                    {emailLoading ? 'Aktualizujem...' : 'Zmeniť email'}
                  </Button>
                </form>
              </div>

              <Separator />

              {/* Password Change Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium mb-3">Heslo</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nové heslo</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Zadajte nové heslo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Potvrdenie hesla</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Potvrďte nové heslo"
                    />
                  </div>

                  <Button type="submit" disabled={passwordLoading} className="sidebar-btn-active font-semibold w-full md:w-auto">
                    {passwordLoading ? 'Aktualizujem...' : 'Zmeniť heslo'}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>

          {/* User Management Section - Only for Admin/Doctor */}
          {canManageUsers && (
            <div>
              <UserManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
