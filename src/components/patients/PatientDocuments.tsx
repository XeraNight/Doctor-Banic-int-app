import { useQuery } from '@tanstack/react-query';
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

  const handleUpload = () => {
    toast({
      title: 'Coming Soon',
      description: 'Document upload functionality will be available soon',
    });
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
        <Button onClick={handleUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
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
                <Button variant="link" className="mt-3" onClick={handleUpload}>
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
