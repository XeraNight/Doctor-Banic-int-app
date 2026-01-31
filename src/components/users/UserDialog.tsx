import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'admin' | 'doctor' | 'patient' | 'zamestnanec';

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
  defaultRole?: UserRole;
}

const UserDialog = ({ open, onOpenChange, user, defaultRole }: UserDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole: currentUserRole } = useAuth();

  // Basic info
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>(defaultRole || 'patient');

  // New user password
  const [password, setPassword] = useState('');

  // Edit existing user
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setRole(user.user_roles?.role || 'patient');
      setNewEmail('');
      setNewPassword('');
    } else {
      setFullName('');
      setEmail('');
      setPhone('');
      setRole(defaultRole || 'patient');
      setPassword('');
      setNewEmail('');
      setNewPassword('');
    }
  }, [user, defaultRole, open]);

  // Determine available roles based on current user's role
  const getAvailableRoles = (): UserRole[] => {
    if (currentUserRole === 'admin') {
      // Admin can assign any role except admin when editing
      return user ? ['doctor', 'zamestnanec', 'patient'] : ['admin', 'doctor', 'zamestnanec', 'patient'];
    } else if (currentUserRole === 'doctor') {
      // Doctor can assign patient, zamestnanec, and other doctors
      return ['patient', 'zamestnanec', 'doctor'];
    }
    return ['patient']; // Default fallback
  };

  const availableRoles = getAvailableRoles();

  const createUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'create',
          email: userData.email,
          password: userData.password,
          fullName: userData.fullName,
          phone: userData.phone,
          role: userData.role,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to create user');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Používateľ úspešne vytvorený',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Chyba',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (userData: any) => {
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'update',
          userId: user.id,
          fullName: userData.fullName,
          phone: userData.phone,
          newEmail: userData.newEmail || null,
          newPassword: userData.newPassword || null,
          newRole: userData.newRole,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Nepodarilo sa aktualizovať používateľa');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Používateľ úspešne aktualizovaný',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Chyba',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName) {
      toast({
        title: 'Chyba',
        description: 'Prosím zadajte celé meno',
        variant: 'destructive',
      });
      return;
    }

    if (user) {
      // Updating existing user
      const userData = {
        fullName,
        phone,
        newEmail: newEmail || null,
        newPassword: newPassword || null,
        newRole: role,
      };
      updateUserMutation.mutate(userData);
    } else {
      // Creating new user
      if (!email || !password) {
        toast({
          title: 'Chyba',
          description: 'Email a heslo sú povinné pre nových používateľov',
          variant: 'destructive',
        });
        return;
      }

      if (password.length < 6) {
        toast({
          title: 'Chyba',
          description: 'Heslo musí mať aspoň 6 znakov',
          variant: 'destructive',
        });
        return;
      }

      const userData = {
        fullName,
        email,
        phone,
        role,
        password,
      };
      createUserMutation.mutate(userData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? 'Upraviť používateľa' : 'Pridať nového používateľa'}</DialogTitle>
          <DialogDescription>
            {user ? 'Upraviť informácie o používateľovi, email, heslo alebo rolu' : 'Vytvoriť nový používateľský účet'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Základné informácie</h3>

            <div className="space-y-2">
              <Label htmlFor="fullName">Celé meno *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Janko Hraško"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefón</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+421 900 000 000"
              />
            </div>
          </div>

          <Separator />

          {/* Email Section */}
          {user ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Email</h3>
              <div className="space-y-2">
                <Label>Súčasný email</Label>
                <Input value={email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newEmail">Nový email (voliteľné)</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Zadajte nový email pre zmenu"
                />
                <p className="text-xs text-muted-foreground">
                  Nechajte prázdne pre zachovanie súčasného emailu
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="janko@priklad.sk"
                required
              />
            </div>
          )}

          <Separator />

          {/* Password Section */}
          {user ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Heslo</h3>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nové heslo (voliteľné)</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Zadajte nové heslo"
                />
                <p className="text-xs text-muted-foreground">
                  Nechajte prázdne pre zachovanie súčasného hesla (min. 6 znakov)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="password">Heslo *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimálne 6 znakov"
                required
              />
            </div>
          )}

          <Separator />

          {/* Role Section */}
          <div className="space-y-2">
            <Label htmlFor="role">Rola *</Label>
            <Select
              value={role}
              onValueChange={(v) => setRole(v as UserRole)}
              disabled={!user && availableRoles.length === 1}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Only Admin can create Admin users */}
                {currentUserRole === 'admin' && !user && (
                  <SelectItem value="admin">Administrátor</SelectItem>
                )}

                {availableRoles.includes('doctor') && (
                  <SelectItem value="doctor">Lekár</SelectItem>
                )}
                {availableRoles.includes('zamestnanec') && (
                  <SelectItem value="zamestnanec">Zamestnanec</SelectItem>
                )}
                {availableRoles.includes('patient') && (
                  <SelectItem value="patient">Pacient</SelectItem>
                )}
              </SelectContent>
            </Select>
            {user && (
              <p className="text-xs text-muted-foreground">
                {currentUserRole === 'admin'
                  ? 'Môžete meniť role okrem na administrátora'
                  : 'Môžete nastaviť len rolu pacienta alebo zamestnanca'}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
              className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0"
            >
              {(createUserMutation.isPending || updateUserMutation.isPending)
                ? 'Ukladám...'
                : user ? 'Aktualizovať' : 'Vytvoriť'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Zrušiť
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UserDialog;
