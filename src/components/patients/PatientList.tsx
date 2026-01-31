import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Users, Search, Mail, Phone, Plus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { SearchBar, type SearchSuggestion } from '@/components/ui/search-bar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PatientDocumentManager from './PatientDocumentManager';

const PatientList = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [patientToDelete, setPatientToDelete] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    insurance_company: '',
    address: '',
    emergency_contact: '',
    emergency_phone: '',
    allergies: '',
    medical_history: ''
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const createPatientMutation = useMutation({
    mutationFn: async (patientData: typeof formData) => {
      const { data, error } = await supabase
        .from('patients')
        .insert([{
          ...patientData,
          date_of_birth: patientData.date_of_birth || null
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Success', description: 'Patient added successfully' });
      setDialogOpen(false);
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        date_of_birth: '',
        insurance_company: '',
        address: '',
        emergency_contact: '',
        emergency_phone: '',
        allergies: '',
        medical_history: ''
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const updatePatientMutation = useMutation({
    mutationFn: async ({ id, patientData }: { id: string; patientData: typeof formData }) => {
      const { data, error } = await supabase
        .from('patients')
        .update({
          ...patientData,
          date_of_birth: patientData.date_of_birth || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Success', description: 'Patient updated successfully' });
      setEditDialogOpen(false);
      setEditingPatient(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const deletePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', patientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast({ title: 'Úspech', description: 'Pacient bol úspešne odstránený' });
      setDeleteDialogOpen(false);
      setPatientToDelete(null);
    },
    onError: (error: any) => {
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      toast({ title: 'Error', description: 'Name and email are required', variant: 'destructive' });
      return;
    }
    createPatientMutation.mutate(formData);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      toast({ title: 'Error', description: 'Name and email are required', variant: 'destructive' });
      return;
    }
    updatePatientMutation.mutate({ id: editingPatient.id, patientData: formData });
  };

  const handleEditClick = (patient: any) => {
    setEditingPatient(patient);
    setFormData({
      full_name: patient.full_name,
      email: patient.email,
      phone: patient.phone || '',
      date_of_birth: patient.date_of_birth || '',
      insurance_company: patient.insurance_company || '',
      address: patient.address || '',
      emergency_contact: patient.emergency_contact || '',
      emergency_phone: patient.emergency_phone || '',
      allergies: patient.allergies || '',
      medical_history: patient.medical_history || ''
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (patient: any) => {
    setPatientToDelete(patient);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (patientToDelete) {
      deletePatientMutation.mutate(patientToDelete.id);
    }
  };

  const filteredPatients = patients?.filter((patient) =>
    patient.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    patient.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Search and Add Button */}
      <div className="flex gap-4">

        <div className="relative flex-1 z-40">
          <SearchBar
            placeholder="Vyhľadať pacientov"
            onSearch={setSearchQuery}
            suggestions={patients ? patients.map((p: any) => ({ label: p.full_name, value: p.full_name, type: 'Pacient' })) : []}
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0 bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0">
              <Plus className="h-4 w-4 mr-2" />
              Pridať pacienta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Pridať nového pacienta</DialogTitle>
              <DialogDescription>
                Vyplňte informácie o novom pacientovi
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Celé meno *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefón</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Dátum narodenia</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insurance_company">Poisťovňa</Label>
                  <Input
                    id="insurance_company"
                    value={formData.insurance_company}
                    onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adresa</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergency_contact">Kontakt v núdzi</Label>
                    <Input
                      id="emergency_contact"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergency_phone">Telefón v núdzi</Label>
                    <Input
                      id="emergency_phone"
                      value={formData.emergency_phone}
                      onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allergies">Alergie</Label>
                  <Input
                    id="allergies"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medical_history">Lekárska história</Label>
                  <Input
                    id="medical_history"
                    value={formData.medical_history}
                    onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Zrušiť
                </Button>
                <Button type="submit" disabled={createPatientMutation.isPending} className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0">
                  {createPatientMutation.isPending ? 'Pridávam...' : 'Pridať pacienta'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Patient Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upraviť pacienta</DialogTitle>
              <DialogDescription>
                Upravte informácie o pacientovi
              </DialogDescription>
            </DialogHeader>
            <div className="py-2">
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Informácie</TabsTrigger>
                  <TabsTrigger value="documents">Dokumenty</TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="mt-4">
                  <form onSubmit={handleEditSubmit}>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_full_name">Celé meno *</Label>
                          <Input
                            id="edit_full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_email">Email *</Label>
                          <Input
                            id="edit_email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_phone">Telefón</Label>
                          <Input
                            id="edit_phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_date_of_birth">Dátum narodenia</Label>
                          <Input
                            id="edit_date_of_birth"
                            type="date"
                            value={formData.date_of_birth}
                            onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_insurance_company">Poisťovňa</Label>
                        <Input
                          id="edit_insurance_company"
                          value={formData.insurance_company}
                          onChange={(e) => setFormData({ ...formData, insurance_company: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_address">Adresa</Label>
                        <Input
                          id="edit_address"
                          value={formData.address}
                          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit_emergency_contact">Kontakt v núdzi</Label>
                          <Input
                            id="edit_emergency_contact"
                            value={formData.emergency_contact}
                            onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_emergency_phone">Telefón v núdzi</Label>
                          <Input
                            id="edit_emergency_phone"
                            value={formData.emergency_phone}
                            onChange={(e) => setFormData({ ...formData, emergency_phone: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_allergies">Alergie</Label>
                        <Input
                          id="edit_allergies"
                          value={formData.allergies}
                          onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit_medical_history">Lekárska história</Label>
                        <Input
                          id="edit_medical_history"
                          value={formData.medical_history}
                          onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                        Zrušiť
                      </Button>
                      <Button type="submit" disabled={updatePatientMutation.isPending} className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0">
                        {updatePatientMutation.isPending ? 'Ukladám...' : 'Uložiť zmeny'}
                      </Button>
                    </DialogFooter>
                  </form>
                </TabsContent>

                <TabsContent value="documents" className="mt-4 min-h-[400px]">
                  {editingPatient && (
                    <PatientDocumentManager 
                      patientId={editingPatient.id} 
                      patientName={editingPatient.full_name} 
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Naozaj chcete odstrániť pacienta?</AlertDialogTitle>
              <AlertDialogDescription>
                Táto akcia je trvalá a nemožno ju vrátiť späť. Pacient <strong>{patientToDelete?.full_name}</strong> a všetky jeho súvisiace záznamy (stretnutia, dokumenty) budú natrvalo odstránené.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deletePatientMutation.isPending}
              >
                {deletePatientMutation.isPending ? 'Odstraňujem...' : 'Odstrániť pacienta'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Patient Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Načítavam pacientov...</p>
            </CardContent>
          </Card>
        ) : filteredPatients && filteredPatients.length > 0 ? (
          filteredPatients.map((patient) => (
            <Card key={patient.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{patient.full_name}</CardTitle>
                {patient.date_of_birth && (
                  <CardDescription>
                    Dátum narodenia: {format(new Date(patient.date_of_birth), 'PP')}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="mr-2 h-4 w-4" />
                  {patient.email}
                </div>
                {patient.phone && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Phone className="mr-2 h-4 w-4" />
                    {patient.phone}
                  </div>
                )}
                {patient.insurance_company && (
                  <div className="mt-2">
                    <Badge variant="secondary">{patient.insurance_company}</Badge>
                  </div>
                )}
                {patient.allergies && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded text-xs">
                    <strong>Alergie:</strong> {patient.allergies}
                  </div>
                )}
                <div className="mt-4 pt-3 border-t flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEditClick(patient)}
                  >
                    <Pencil className="h-3 w-3 mr-2" />
                    Upraviť
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDeleteClick(patient)}
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Odstrániť
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="p-6">
              <div className="text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'Nenašli sa žiadni pacienti zodpovedajúci vyhľadávaniu' : 'Zatiaľ nie sú registrovaní žiadni pacienti'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PatientList;
