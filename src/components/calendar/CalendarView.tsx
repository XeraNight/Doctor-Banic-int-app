import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Plus, Filter, Edit, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import AppointmentDialog from './AppointmentDialog';
import { SearchBar, type SearchSuggestion } from '@/components/ui/search-bar';

interface CalendarViewProps {
  viewType: 'admin' | 'doctor' | 'patient';
}

const CalendarView = ({ viewType }: CalendarViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [activeCalendar, setActiveCalendar] = useState<'doctor' | 'client' | 'team'>('doctor');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', viewType, user?.id, activeCalendar],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, email, user_id)
        `)
        .order('appointment_date', { ascending: true });

      if (viewType === 'patient') {
        // First get patient ID for current user
        const { data: patientData } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        if (patientData) {
          query = query.eq('patient_id', patientData.id);
        }
      } else if (viewType === 'admin') {
        if (activeCalendar === 'doctor') {
          query = query.eq('is_team_calendar', false);
        } else if (activeCalendar === 'team') {
          query = query.eq('is_team_calendar', true);
        }
        // Admin sees all appointments (no doctor_id filter needed)
      } else if (viewType === 'doctor') {
        if (activeCalendar === 'doctor') {
          query = query.eq('doctor_id', user?.id).eq('is_team_calendar', false);
        } else if (activeCalendar === 'team') {
          query = query.eq('is_team_calendar', true);
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-success text-success-foreground';
      case 'pending':
        return 'bg-warning text-warning-foreground';
      case 'completed':
        return 'bg-muted text-muted-foreground';
      case 'cancelled':
        return 'bg-destructive text-destructive-foreground';
      case 'no_show':
        return 'bg-destructive/80 text-destructive-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      consultation: 'Consultation',
      control: 'Control',
      cardiology: 'Cardiology',
      internal: 'Internal',
      emergency: 'Emergency',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Appointment deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (appointment: any) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDialog(true);
  };

  const handleDelete = async (appointmentId: string) => {
    if (confirm('Are you sure you want to delete this appointment?')) {
      deleteAppointmentMutation.mutate(appointmentId);
    }
  };

  const filteredAppointments = appointments?.filter((appointment: any) => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase();
    const patientName = appointment.patient?.full_name?.toLowerCase() || '';
    const appointmentDate = format(new Date(appointment.appointment_date), 'PPP p').toLowerCase();
    const appointmentType = getTypeLabel(appointment.appointment_type).toLowerCase();
    const reason = appointment.reason?.toLowerCase() || '';
    const room = appointment.room?.toLowerCase() || '';
    const status = appointment.status?.toLowerCase() || '';

    return patientName.includes(search) ||
      appointmentDate.includes(search) ||
      appointmentType.includes(search) ||
      reason.includes(search) ||
      room.includes(search) ||
      status.includes(search);
  });

  const searchSuggestions: SearchSuggestion[] = appointments
    ? Array.from(new Set(appointments.map((a: any) => a.patient?.full_name).filter(Boolean)))
      .map((name: any) => ({
        label: name,
        value: name,
        type: 'Patient'
      }))
    : [];

  const renderAppointmentsList = () => (
    <div className="grid gap-4">
      {isLoading ? (
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Loading appointments...</p>
          </CardContent>
        </Card>
      ) : filteredAppointments && filteredAppointments.length > 0 ? (
        filteredAppointments.map((appointment: any) => (
          <Card key={appointment.id} className="hover-lift border-primary/10 hover:border-primary/30 transition-all animate-scale-in">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg">
                    {viewType === 'patient'
                      ? `Appointment with ${appointment.doctor?.full_name || 'Doctor'}`
                      : appointment.patient?.full_name || 'Unknown Patient'}
                  </CardTitle>
                  <CardDescription>
                    {format(new Date(appointment.appointment_date), 'PPP p')}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge className={getStatusColor(appointment.status)}>
                    {appointment.status}
                  </Badge>
                  <Badge variant="outline">
                    {getTypeLabel(appointment.appointment_type)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {appointment.reason && (
                <p className="text-sm text-muted-foreground">
                  <strong>Reason:</strong> {appointment.reason}
                </p>
              )}
              {appointment.room && (
                <p className="text-sm text-muted-foreground mt-1">
                  <strong>Room:</strong> {appointment.room}
                </p>
              )}
              {appointment.medical_notes && viewType !== 'patient' && (
                <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted rounded">
                  <strong>Medical Notes:</strong> {appointment.medical_notes}
                </p>
              )}
              {viewType !== 'patient' && (
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(appointment)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(appointment.id)}
                    disabled={deleteAppointmentMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No appointments found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {viewType === 'patient'
                  ? 'Request your first appointment to get started'
                  : 'Create a new appointment to get started'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  if (viewType === 'patient') {
    return (
      <div className="space-y-6">
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <SearchBar 
              placeholder="Hľadať termíny..." 
              onSearch={setSearchTerm}
              suggestions={searchSuggestions}
            />
          </div>
          <Button onClick={() => setShowAppointmentDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request Appointment
          </Button>
        </div>
        {renderAppointmentsList()}
        <AppointmentDialog
          open={showAppointmentDialog}
          onOpenChange={(open) => {
            setShowAppointmentDialog(open);
            if (!open) setSelectedAppointment(null);
          }}
          viewType={viewType}
          appointment={selectedAppointment}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 h-16 flex items-center z-40">
          <SearchBar 
            placeholder="Hľadať termíny..." 
            onSearch={setSearchTerm}
            suggestions={searchSuggestions}
          />
        </div>
        <Button onClick={() => setShowAppointmentDialog(true)} className="gradient-primary text-primary-foreground hover-lift">
          <Plus className="mr-2 h-4 w-4" />
          New Appointment
        </Button>
      </div>

      <Tabs value={activeCalendar} onValueChange={(v) => setActiveCalendar(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger
            value="doctor"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            My Calendar
          </TabsTrigger>
          <TabsTrigger
            value="client"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            Doctor + Employees
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all"
          >
            Everyone Together
          </TabsTrigger>
        </TabsList>

        <TabsContent value="doctor" className="mt-6 animate-fade-in">
          <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-primary">My Calendar</CardTitle>
              <CardDescription>Your personal appointments as doctor/creator</CardDescription>
            </CardHeader>
          </Card>
          {renderAppointmentsList()}
        </TabsContent>

        <TabsContent value="client" className="mt-6 animate-fade-in">
          <Card className="mb-4 border-accent/20 bg-gradient-to-r from-accent/5 to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-accent">Doctor + Employees Calendar</CardTitle>
              <CardDescription>Appointments visible to doctors and employees only</CardDescription>
            </CardHeader>
          </Card>
          {renderAppointmentsList()}
        </TabsContent>

        <TabsContent value="team" className="mt-6 animate-fade-in">
          <Card className="mb-4 border-primary/20 gradient-primary">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-primary-foreground">Everyone Together</CardTitle>
              <CardDescription className="text-primary-foreground/80">Shared calendar visible to all team members</CardDescription>
            </CardHeader>
          </Card>
          {renderAppointmentsList()}
        </TabsContent>
      </Tabs>

      <AppointmentDialog
        open={showAppointmentDialog}
        onOpenChange={(open) => {
          setShowAppointmentDialog(open);
          if (!open) setSelectedAppointment(null);
        }}
        viewType={viewType}
        appointment={selectedAppointment}
      />
    </div>
  );
};

export default CalendarView;
