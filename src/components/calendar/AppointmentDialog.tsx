import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewType: 'admin' | 'doctor' | 'patient';
  appointment?: any;
}

const AppointmentDialog = ({ open, onOpenChange, viewType, appointment }: AppointmentDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentType, setAppointmentType] = useState('consultation');
  const [reason, setReason] = useState('');
  const [selectedPatient, setSelectedPatient] = useState('');
  const [status, setStatus] = useState('pending');
  const [room, setRoom] = useState('');

  useEffect(() => {
    if (appointment && open) {
      const date = new Date(appointment.appointment_date);
      setAppointmentDate(date.toISOString().split('T')[0]);
      setAppointmentTime(date.toTimeString().slice(0, 5));
      setAppointmentType(appointment.appointment_type);
      setReason(appointment.reason || '');
      setSelectedPatient(appointment.patient_id);
      setStatus(appointment.status || 'pending');
      setRoom(appointment.room || '');
    } else if (!open) {
      resetForm();
    }
  }, [appointment, open]);

  // Fetch patients for admin/doctor
  const { data: patients } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: viewType !== 'patient' && open,
  });

  // Get current user's patient record for patient view
  const { data: currentPatient } = useQuery({
    queryKey: ['current-patient', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: viewType === 'patient' && open,
  });

  const saveAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      if (appointment) {
        const { data, error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', appointment.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: appointment 
          ? 'Appointment updated successfully'
          : viewType === 'patient' 
            ? 'Appointment request submitted successfully'
            : 'Appointment created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentType('consultation');
    setReason('');
    setSelectedPatient('');
    setStatus('pending');
    setRoom('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointmentDate || !appointmentTime) {
      toast({
        title: 'Error',
        description: 'Please select date and time',
        variant: 'destructive',
      });
      return;
    }

    if (viewType !== 'patient' && !selectedPatient) {
      toast({
        title: 'Error',
        description: 'Please select a patient',
        variant: 'destructive',
      });
      return;
    }

    const patientId = viewType === 'patient' ? currentPatient?.id : selectedPatient;

    if (!patientId) {
      toast({
        title: 'Error',
        description: 'Patient information is required',
        variant: 'destructive',
      });
      return;
    }

    const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`);

    const appointmentData = {
      patient_id: patientId,
      doctor_id: viewType === 'patient' ? null : user?.id,
      appointment_date: appointmentDateTime.toISOString(),
      appointment_type: appointmentType,
      reason: reason || null,
      status: viewType === 'patient' ? 'pending' : status,
      room: room || null,
      is_team_calendar: false,
    };

    saveAppointmentMutation.mutate(appointmentData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {appointment 
              ? 'Edit Appointment' 
              : viewType === 'patient' ? 'Request Appointment' : 'Create Appointment'}
          </DialogTitle>
          <DialogDescription>
            {appointment 
              ? 'Update appointment details'
              : viewType === 'patient' 
                ? 'Submit a request for a new appointment'
                : 'Schedule a new appointment'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {viewType !== 'patient' && (
            <div className="space-y-2">
              <Label htmlFor="patient">Patient</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={appointmentTime}
              onChange={(e) => setAppointmentTime(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={appointmentType} onValueChange={setAppointmentType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="control">Control</SelectItem>
                <SelectItem value="cardiology">Cardiology</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Describe the reason for the visit"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {viewType !== 'patient' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="room">Room (Optional)</Label>
                <Input
                  id="room"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="Room 101"
                />
              </div>
            </>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={saveAppointmentMutation.isPending}>
              {saveAppointmentMutation.isPending 
                ? 'Saving...' 
                : appointment ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDialog;
