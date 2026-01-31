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
import FileUpload from '@/components/ui/FileUpload';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react';

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

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

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
  const { data: currentPatient, isLoading } = useQuery({
    queryKey: ['current-patient', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user?.id)
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: viewType === 'patient' && open && !!user,
  });

  // Auto-create patient profile if missing
  const createProfileMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('patients')
        .insert({
          user_id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Unknown',
          email: user.email || '',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-patient'] });
      toast({ title: 'Profile Created', description: 'Your patient profile has been initialized.' });
    },
    onError: (err) => {
      console.error('Failed to create profile:', err);
    }
  });

  useEffect(() => {
    if (viewType === 'patient' && open && !isLoading && currentPatient === null && user) {
      createProfileMutation.mutate();
    }
  }, [currentPatient, isLoading, viewType, open, user]);

  const uploadFile = async (appointmentId: string, patientId: string) => {
    if (!selectedFile) return;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user?.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      let detectedFileType = 'other';
      if (selectedFile.type.startsWith('image/')) detectedFileType = 'image';
      else if (selectedFile.type === 'application/pdf') detectedFileType = 'pdf';
      else if (selectedFile.type.startsWith('text/')) detectedFileType = 'text';

      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          patient_id: patientId,
          appointment_id: appointmentId,
          uploaded_by: user?.id,
          file_name: fileName || selectedFile.name,
          file_url: publicUrl,
          file_type: detectedFileType,
          file_size: selectedFile.size,
          description: 'Uploaded during appointment creation',
        });

      if (dbError) throw dbError;

    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload Failed',
        description: 'Failed to upload attachment, but appointment was saved.',
        variant: 'destructive',
      });
    }
  };

  const saveAppointmentMutation = useMutation({
    mutationFn: async (appointmentData: any) => {
      let savedAppointment;
      
      if (appointment) {
        const { data, error } = await supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', appointment.id)
          .select()
          .single();
        if (error) throw error;
        savedAppointment = data;
      } else {
        const { data, error } = await supabase
          .from('appointments')
          .insert(appointmentData)
          .select()
          .single();
        if (error) throw error;
        savedAppointment = data;
      }

      // Handle file upload if present
      if (selectedFile && savedAppointment) {
        setUploading(true);
        await uploadFile(savedAppointment.id, savedAppointment.patient_id);
        setUploading(false);
      }

      return savedAppointment;
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
      // Also invalidate documents in case we're viewing them somewhere
      queryClient.invalidateQueries({ queryKey: ['all-documents'] }); 
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      setUploading(false);
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
    setSelectedFile(null);
    setFileName('');
    setShowFileUpload(false);
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



    // Determine patient ID
    let patientId = viewType === 'patient' ? currentPatient?.id : selectedPatient;

    // Retry fetching/waiting if auto-creation is happening or just slow
    if (viewType === 'patient' && !patientId) {
       toast({
        title: 'Please wait',
        description: 'Initializing your profile...',
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
      created_by: user?.id,
    };

    saveAppointmentMutation.mutate(appointmentData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

          <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          )}

          <Collapsible
            open={showFileUpload}
            onOpenChange={setShowFileUpload}
            className="border rounded-md p-2 bg-muted/20"
          >
            <div className="flex items-center justify-between px-2">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Doplnkový dokument
              </h4>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" type="button">
                  {showFileUpload ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span className="sr-only">Toggle Upload</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="space-y-4 pt-4 px-2">
              <div className="space-y-2">
                <Label>Vybrať súbor</Label>
                <FileUpload
                   onFileSelect={(file) => {
                    setSelectedFile(file);
                    if (file && !fileName) {
                      setFileName(file.name.split('.').slice(0, -1).join('.'));
                    }
                  }}
                  maxSize={5 * 1024 * 1024} // 5MB limit for appointments
                />
              </div>
              {selectedFile && (
                <div className="space-y-2">
                   <Label htmlFor="doc-name">Názov dokumentu</Label>
                   <Input 
                      id="doc-name"
                      value={fileName} 
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="Názov súboru"
                   />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="flex gap-3 pt-2">
            <Button 
              type="submit" 
              disabled={saveAppointmentMutation.isPending || uploading} 
              className="w-full bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0"
            >
              {saveAppointmentMutation.isPending || uploading
                ? 'Saving...' 
                : appointment ? 'Update Appointment' : 'Create Appointment'}
            </Button>
          </div>
          {viewType === 'patient' && !currentPatient && open && (
            <p className="text-sm text-yellow-600 text-center">
              {createProfileMutation.isPending ? 'Vytváram profil...' : 'Načítavam profil pacienta...'}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AppointmentDialog;
