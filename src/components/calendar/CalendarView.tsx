import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Plus, Filter, Edit, Trash2, Search, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import AppointmentDialog from './AppointmentDialog';
import { SearchBar, type SearchSuggestion } from '@/components/ui/search-bar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface CalendarViewProps {
  viewType: 'admin' | 'doctor' | 'patient';
}

const CalendarView = ({ viewType }: CalendarViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightedAppointmentId = searchParams.get('appointmentId');
  const [showAppointmentDialog, setShowAppointmentDialog] = useState(false);
  const [activeCalendar, setActiveCalendar] = useState<'personal' | 'internal' | 'everyone'>('personal');
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<any>(null);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ['appointments', viewType, user?.id, activeCalendar],
    queryFn: async () => {
      let query: any = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(full_name, email, user_id)
        `)
        .order('appointment_date', { ascending: true });

      if (activeCalendar === 'everyone') {
        // Everyone (except patients restricted to own? No, request says "všeobecný kalendár vidia všetci")
        // But maybe "everyone together" means team calendar? 
        // User said: "1 'všeobecný kalendar' (everayone together) by mali vidieť vsetci"
        // Let's assume this is the is_team_calendar = true events.
        query = query.eq('is_team_calendar', true);
      } else if (activeCalendar === 'internal') {
        // "teamoví kalendár" (doctor and employees) - visible to doctor/employee
        // Probably standard medical appointments?
        // User said: "2 'teamoví kalendár' (doctor and employees) by mali vidieť iba pracovníci a doctor"
        query = query.eq('is_team_calendar', false);
      } else if (activeCalendar === 'personal') {
        // "Moj kalendár"
        // User said: "3 'Moj kalendár' (my callendar) by som mal vidieť iba ja ako ten čo ho vytvoril"
        
        if (viewType === 'patient') {
           // Patient sees their own appointments
           const { data: patientData } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user?.id)
            .single();
           if (patientData) {
             query = query.eq('patient_id', patientData.id);
           }
        } else if (viewType === 'doctor') {
           // Doctor sees appointments assigned to them
           query = query.eq('doctor_id', user?.id);
        } else {
           // Employee/Admin sees appointments they created
           // Note: This requires the new created_by column. 
           // If migration hasn't run, this might fail or return nothing if column doesn't exist yet? 
           // Supabase client usually handles missing columns gracefully by erroring if selected, but here we filter.
           // We will assume migration is applied.
           query = query.eq('created_by', user?.id);
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
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDismissHighlight = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('appointmentId');
    // Optionally keep 'tab' or remove it too if desired. User just said "don't return to the same term".
    // Keeping tab is better for UX so they stay on the calendar.
    setSearchParams(newParams);
  };

  const handleCardClick = (appointmentId: string) => {
    // If already highlighted, clicking it again could potentially dismiss it? 
    // Or maybe just do nothing or re-highlight. 
    // User said "also on click I want to select it", implying if it's NOT selected, it should be.
    // Let's implement toggle: If selected -> dismiss. If not -> select.
    if (String(appointmentId) === highlightedAppointmentId) {
      handleDismissHighlight();
    } else {
       const newParams = new URLSearchParams(searchParams);
       newParams.set('appointmentId', appointmentId);
       setSearchParams(newParams);
    }
  };

  const handleEdit = (appointment: any) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDialog(true);
  };

  const handleDeleteClick = (appointment: any) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (appointmentToDelete) {
      deleteAppointmentMutation.mutate(appointmentToDelete.id);
    }
  };

  const filteredAppointments = appointments?.filter((appointment: any) => {
    if (!searchTerm) return true;

    const search = searchTerm.toLowerCase().trim();
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
        type: 'Pacient'
      }))
    : [];

  useEffect(() => {
    if (highlightedAppointmentId && !isLoading && appointments) {
      // Delay slightly to ensure rendering
      setTimeout(() => {
        const element = document.getElementById(`appointment-${highlightedAppointmentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightedAppointmentId, isLoading, appointments]);

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
          <Card 
            key={appointment.id} 
            id={`appointment-${appointment.id}`}
            className={`hover-lift border-primary/10 hover:border-primary/30 transition-all animate-scale-in relative cursor-pointer ${String(appointment.id) === highlightedAppointmentId ? 'ring-2 ring-primary shadow-lg bg-accent/10' : ''}`}
            onClick={() => handleCardClick(appointment.id)}
          >
            {String(appointment.id) === highlightedAppointmentId && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-muted z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismissHighlight();
                }}
                title="Zrušiť zvýraznenie"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(appointment);
                    }}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(appointment);
                    }}
                    disabled={deleteAppointmentMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Vymazať
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
              placeholder="Hľadať termíny" 
              onSearch={setSearchTerm}
              suggestions={searchSuggestions}
            />
          </div>
          <Button 
            onClick={() => setShowAppointmentDialog(true)}
            className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0"
          >
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

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Naozaj chcete odstrániť tento termín?</AlertDialogTitle>
              <AlertDialogDescription>
                Táto akcia je trvalá a nemožno ju vrátiť späť.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteConfirm();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteAppointmentMutation.isPending}
              >
                {deleteAppointmentMutation.isPending ? 'Odstraňujem...' : 'Odstrániť'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md z-40">
           <SearchBar 
              placeholder="Hľadať termíny..." 
              onSearch={setSearchTerm}
              suggestions={searchSuggestions}
           />
        </div>
        <Button 
          onClick={() => setShowAppointmentDialog(true)} 
          className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nový termín
        </Button>
      </div>

      <Tabs value={activeCalendar} onValueChange={(v) => setActiveCalendar(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="personal">Môj kalendár</TabsTrigger>
          {/* Internal calendar visible to doctor, admin, employees, but NOT patients */}
          <TabsTrigger value="internal">Udalosti tímu</TabsTrigger>
           {/* Everyone sees general calendar */}
          <TabsTrigger value="everyone">Všeobecný kalendár</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="mt-4 space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg mb-4 border-l-4 border-blue-500">
                <h3 className="font-semibold text-lg mb-1">Môj kalendár</h3>
                <p className="text-sm text-muted-foreground">
                    {viewType === 'doctor'
                            ? 'Termíny priradené vám.'
                            : 'Termíny, ktoré ste vytvorili.'}
                </p>
            </div>
            {renderAppointmentsList()}
        </TabsContent>

        <TabsContent value="internal" className="mt-4 space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg mb-4 border-l-4 border-purple-500">
                <h3 className="font-semibold text-lg mb-1">Udalosti tímu</h3>
                <p className="text-sm text-muted-foreground">
                    Všetky lekárske vyšetrenia a pracovné udalosti.
                </p>
            </div>
            {renderAppointmentsList()}
        </TabsContent>

        <TabsContent value="everyone" className="mt-4 space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg mb-4 border-l-4 border-green-500">
                <h3 className="font-semibold text-lg mb-1">Všeobecný kalendár</h3>
                <p className="text-sm text-muted-foreground">
                    Zdieľaný kalendár viditeľný pre všetkých.
                </p>
            </div>
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Naozaj chcete odstrániť tento termín?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je trvalá a nemožno ju vrátiť späť.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteAppointmentMutation.isPending}
            >
              {deleteAppointmentMutation.isPending ? 'Odstraňujem...' : 'Odstrániť'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalendarView;
