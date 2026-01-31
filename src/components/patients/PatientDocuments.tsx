import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const PatientDocuments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: currentPatient, isLoading: isProfileLoading } = useQuery({
    queryKey: ['current-patient', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['patient-documents', currentPatient?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('patient_id', currentPatient?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentPatient,
  });

  // Lazy profile creation during upload - no blocking UI
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      let targetPatientId = currentPatient?.id;

      // 1. Ensure Patient Profile Exists
      if (!targetPatientId) {
        // Check DB directly
        const { data: existing } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user?.id)
          .maybeSingle();
        
        if (existing) {
          targetPatientId = existing.id;
        } else {
          // Create new profile via RPC (bypasses RLS)
          const { data: newPatient, error: createError } = await supabase
            .rpc('create_my_patient_profile' as any, {
              full_name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown',
              email: user?.email || '',
            });
          
          if (createError) throw createError;
          // RPC returns the object directly, but typed as json. We cast or assume it has id.
          // Note: The function returns "row_to_json", so data is the object.
          targetPatientId = (newPatient as any).id;
          
          // Refresh the query to show the new profile in UI eventually
          queryClient.invalidateQueries({ queryKey: ['current-patient'] });
        }
      }

      if (!targetPatientId) throw new Error('Could not initialize patient profile.');

      // 2. Upload to Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${targetPatientId}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // 3. Create DB Record
      const { error: dbError } = await supabase
        .from('documents')
        .insert({
          patient_id: targetPatientId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: fileExt,
          file_size: file.size,
          description: 'Uploaded by patient',
          uploaded_by: user?.id
        });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Document uploaded successfully' });
      queryClient.invalidateQueries({ queryKey: ['patient-documents'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadMutation.mutate(file);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">My Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload and manage your medical documents
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button 
            onClick={handleUploadClick} 
            disabled={isUploading}
            className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isUploading ? 'Nahrávam...' : 'Nahrať dokument'}
          </Button>
        </div>
      </div>

      {/* Documents List */}
      <div className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Loading documents...</p>
            </CardContent>
          </Card>
        ) : documents && documents.length > 0 ? (
          documents.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-base">{document.file_name}</CardTitle>
                    <CardDescription>
                      Uploaded {format(new Date(document.created_at), 'PP')}
                    </CardDescription>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {document.description && (
                  <p className="text-sm text-muted-foreground mb-3">{document.description}</p>
                )}
                <div className="flex gap-2">
                  <Badge variant="secondary">{document.file_type || 'Document'}</Badge>
                  {document.file_size && (
                    <Badge variant="outline">
                      {(document.file_size / 1024).toFixed(2)} KB
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="p-6">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No documents uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload lab results, reports, or other medical documents
                </p>
                <Button variant="link" className="mt-3" onClick={handleUploadClick}>
                  Upload your first document
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PatientDocuments;
