import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import UserDialog from './UserDialog';

type UserRole = 'admin' | 'doctor' | 'patient' | 'zamestnanec';

interface UserManagementProps {
  role?: UserRole;
}

const UserManagement = ({ role }: UserManagementProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', role],
    queryFn: async () => {
      // 1. Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');

      if (profilesError) throw profilesError;

      // 2. Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // 3. Merge data
      const usersWithRoles = profiles.map((profile) => {
        const userRole = rolesData.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          user_roles: userRole ? { role: userRole.role } : null,
        };
      });

      // 4. Filter by role if needed
      if (role) {
        return usersWithRoles.filter((user) => user.user_roles?.role === role);
      }

      return usersWithRoles;
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await supabase.functions.invoke('manage-users', {
        body: {
          action: 'delete',
          userId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Nepodarilo sa vymazať používateľa');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Používateľ bol úspešne vymazaný',
      });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Chyba',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const filteredUsers = users?.filter((user: any) =>
    (user.full_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'doctor':
        return 'default';
      case 'zamestnanec':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrátor',
      doctor: 'Lekár',
      zamestnanec: 'Zamestnanec',
      patient: 'Pacient',
    };
    return labels[role] || role || 'Žiadna rola';
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setShowDialog(true);
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Naozaj chcete vymazať tohto používateľa?')) {
      deleteUserMutation.mutate(userId);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              {role ? `${getRoleLabel(role)}i` : 'Všetci používatelia'}
            </CardTitle>
            <Button onClick={() => {
              setSelectedUser(null);
              setShowDialog(true);
            }} className="sidebar-btn-active font-semibold">
              <Plus className="mr-2 h-4 w-4 text-white" />
              Pridať používateľa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať podľa mena alebo emailu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Meno</TableHead>
                  <TableHead>Email</TableHead>
                  {!role && <TableHead>Rola</TableHead>}
                  <TableHead>Telefón</TableHead>
                  <TableHead>Vytvorené</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={role ? 5 : 6} className="text-center">
                      Načítavam...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers && filteredUsers.length > 0 ? (
                  filteredUsers.map((user: any) => (
                    <TableRow key={user.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      {!role && (
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(user.user_roles?.role)}>
                            {getRoleLabel(user.user_roles?.role)}
                          </Badge>
                        </TableCell>
                      )}
                      <TableCell>{user.phone || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(user.created_at), 'PP')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(user.id)}
                            disabled={deleteUserMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={role ? 5 : 6} className="text-center text-muted-foreground">
                      Žiadni používatelia
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UserDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        user={selectedUser}
        defaultRole={role}
      />
    </div>
  );
};

export default UserManagement;
