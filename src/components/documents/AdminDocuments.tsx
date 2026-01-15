import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Upload, Trash2, Search, Plus, Eye, Download, Maximize2, Minimize2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import FileUpload from '@/components/ui/FileUpload';

const AdminDocuments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<string>('none');
  const [fileName, setFileName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<any>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isFullPreview, setIsFullPreview] = useState(true);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);

  // Load image and calculate aspect ratio when preview document changes
  useEffect(() => {
    if (previewDocument?.file_url && previewDocument?.file_type === 'image') {
      const img = new Image();
      img.onload = () => {
        setImageAspectRatio(img.width / img.height);
      };
      img.src = previewDocument.file_url;
    } else {
      setImageAspectRatio(null);
    }
  }, [previewDocument]);

  // Fetch all patients
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
  });

  // Fetch all documents with patient info
  const { data: documents, isLoading } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          patient:patients(full_name, email)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (documentData: any) => {
      const { data, error } = await supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Dokument úspešne pridaný',
      });
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
      setShowUploadDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: 'Chyba',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Dokument úspešne vymazaný',
      });
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Chyba',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setSelectedPatient('none');
    setFileName('');
    setSelectedFile(null);
    setFileType('');
    setDescription('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !fileName) {
      toast({
        title: 'Chyba',
        description: 'Prosím vyberte súbor a zadajte názov',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);

    try {
      // Upload file to Supabase Storage
      const fileExt = selectedFile.name.split('.').pop();
      const filePath = `${user?.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      // Determine file type from MIME type
      let detectedFileType = fileType;
      if (!detectedFileType) {
        if (selectedFile.type.startsWith('image/')) detectedFileType = 'image';
        else if (selectedFile.type === 'application/pdf') detectedFileType = 'pdf';
        else if (selectedFile.type.startsWith('video/')) detectedFileType = 'video';
        else if (selectedFile.type.startsWith('text/')) detectedFileType = 'text';
        else if (selectedFile.name.endsWith('.xlsx')) detectedFileType = 'excel';
        else if (selectedFile.name.endsWith('.ods')) detectedFileType = 'ods';
        else if (selectedFile.name.endsWith('.html')) detectedFileType = 'html';
        else if (selectedFile.name.endsWith('.csv')) detectedFileType = 'csv';
        else if (selectedFile.name.endsWith('.tsv')) detectedFileType = 'tsv';
        else detectedFileType = 'other';
      }

      // Save document record to database
      uploadDocumentMutation.mutate({
        patient_id: selectedPatient === 'none' ? null : selectedPatient,
        uploaded_by: user?.id,
        file_name: fileName,
        file_url: publicUrl,
        file_type: detectedFileType,
        file_size: selectedFile.size,
        description: description || null,
      });
    } catch (error: any) {
      toast({
        title: 'Chyba pri nahrávaní',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      // Fetch the file
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Download failed');

      // Convert to blob
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Úspech',
        description: 'Súbor bol stiahnutý',
      });
    } catch (error: any) {
      toast({
        title: 'Chyba pri sťahovaní',
        description: error.message,
        variant: 'destructive',
      });
    }
  };


  const handlePreview = (document: any) => {
    setPreviewDocument(document);
    setShowPreviewDialog(true);
  };

  const handleDelete = (documentId: string) => {
    if (confirm('Naozaj chcete vymazať tento dokument? Táto akcia je nevratná.')) {
      deleteDocumentMutation.mutate(documentId);
    }
  };

  const filteredDocuments = documents?.filter((doc: any) => {
    const search = searchTerm.toLowerCase();
    return (
      doc.file_name?.toLowerCase().includes(search) ||
      doc.patient?.full_name?.toLowerCase().includes(search) ||
      doc.description?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header with search and add button */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Vyhľadať dokumenty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Pridať dokument
        </Button>
      </div>

      {/* Documents List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="p-6">
              <p className="text-center text-muted-foreground">Načítavam dokumenty...</p>
            </CardContent>
          </Card>
        ) : filteredDocuments && filteredDocuments.length > 0 ? (
          filteredDocuments.map((document: any) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{document.file_name}</CardTitle>
                    <CardDescription className="truncate">
                      Pacient: {document.patient?.full_name || 'Neznámy'}
                    </CardDescription>
                  </div>
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Nahrané {format(new Date(document.created_at), 'PP')}
                </p>
                {document.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{document.description}</p>
                )}
                <div className="flex gap-2 mb-3 flex-wrap">
                  <Badge variant="secondary">{document.file_type || 'Dokument'}</Badge>
                  {document.file_size && (
                    <Badge variant="outline">
                      {(document.file_size / 1024).toFixed(2)} KB
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePreview(document)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Zobraziť
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(document.file_url, document.file_name)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Stiahnuť
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(document.id)}
                    disabled={deleteDocumentMutation.isPending}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Vymazať
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full">
            <CardContent className="p-6">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenašli sa žiadne dokumenty</p>
                <Button variant="link" className="mt-3" onClick={() => setShowUploadDialog(true)}>
                  Pridajte svoj prvý dokument
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pridať dokument</DialogTitle>
            <DialogDescription>
              Pridať záznam dokumentu pre pacienta
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="patient">Pacient</Label>
              <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte pacienta alebo nechajte nepriradené" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Žiadny pacient (voľný dokument)</SelectItem>
                  {patients?.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Súbor *</Label>
              <FileUpload
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  if (file && !fileName) {
                    // Auto-fill filename from uploaded file
                    setFileName(file.name.split('.').slice(0, -1).join('.'));
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fileName">Názov súboru *</Label>
              <Input
                id="fileName"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Laboratórne výsledky - December 2024"
                required
              />
            </div>



            <div className="space-y-2">
              <Label htmlFor="fileType">Typ súboru</Label>
              <Select value={fileType} onValueChange={setFileType}>
                <SelectTrigger>
                  <SelectValue placeholder="Vyberte typ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="ods">OpenDocument (.ods)</SelectItem>
                  <SelectItem value="html">Webová stránka (.html)</SelectItem>
                  <SelectItem value="csv">CSV (.csv)</SelectItem>
                  <SelectItem value="tsv">TSV (.tsv)</SelectItem>
                  <SelectItem value="image">Obrázok</SelectItem>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="lab_result">Laboratórny výsledok</SelectItem>
                  <SelectItem value="prescription">Lekársky predpis</SelectItem>
                  <SelectItem value="report">Správa</SelectItem>
                  <SelectItem value="other">Iné</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Popis</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Krátky popis dokumentu"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={uploading || uploadDocumentMutation.isPending}>
                {uploading || uploadDocumentMutation.isPending ? 'Nahrávam...' : 'Pridať dokument'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowUploadDialog(false)}>
                Zrušiť
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{previewDocument?.file_name}</DialogTitle>
            <DialogDescription>
              {previewDocument?.description || 'Náhľad dokumentu'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Document info and toggle */}
            <div className="flex justify-between items-start gap-2">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">
                  {previewDocument?.file_type || 'Dokument'}
                </Badge>
                {previewDocument?.patient?.full_name && (
                  <Badge variant="outline">
                    Pacient: {previewDocument.patient.full_name}
                  </Badge>
                )}
                {previewDocument?.file_size && (
                  <Badge variant="outline">
                    {(previewDocument.file_size / 1024).toFixed(2)} KB
                  </Badge>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullPreview(!isFullPreview)}
              >
                {isFullPreview ? (
                  <>
                    <Minimize2 className="mr-2 h-4 w-4" />
                    Kompaktný režim
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-2 h-4 w-4" />
                    Plná veľkosť
                  </>
                )}
              </Button>
            </div>

            {/* Preview content - full or split layout */}
            {isFullPreview ? (
              // Full preview mode
              <div className="w-full h-[60vh] border rounded-lg overflow-hidden bg-muted">
                {previewDocument?.file_url && (
                  <iframe
                    src={previewDocument.file_url}
                    className="w-full h-full"
                    title={previewDocument.file_name}
                  />
                )}
              </div>
            ) : (
              // Compact mode - split view
              <div className="flex gap-4 h-[60vh]">
                {/* Information panel - left side */}
                <div className="w-80 flex-shrink-0 border rounded-lg p-4 bg-accent/5 overflow-y-auto">
                  <h3 className="font-semibold text-lg mb-4">Informácie o dokumente</h3>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Názov súboru</Label>
                      <p className="text-sm font-medium">{previewDocument?.file_name}</p>
                    </div>

                    {previewDocument?.description && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Popis</Label>
                        <p className="text-sm">{previewDocument.description}</p>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs text-muted-foreground">Typ</Label>
                      <p className="text-sm">{previewDocument?.file_type || 'Neznámy'}</p>
                    </div>

                    {previewDocument?.patient?.full_name && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Pacient</Label>
                        <p className="text-sm">{previewDocument.patient.full_name}</p>
                        {previewDocument.patient.email && (
                          <p className="text-xs text-muted-foreground">{previewDocument.patient.email}</p>
                        )}
                      </div>
                    )}

                    {previewDocument?.file_size && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Veľkosť súboru</Label>
                        <p className="text-sm">{(previewDocument.file_size / 1024).toFixed(2)} KB</p>
                      </div>
                    )}

                    {previewDocument?.created_at && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Nahrané</Label>
                        <p className="text-sm">{format(new Date(previewDocument.created_at), 'PP')}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview - right side */}
                <div className="flex-1 flex items-center justify-center">
                  {previewDocument?.file_url && (
                    previewDocument?.file_type === 'image' ? (
                      <div
                        className="relative border rounded-lg overflow-hidden bg-muted"
                        style={{
                          aspectRatio: imageAspectRatio || 1,
                          maxWidth: '100%',
                          maxHeight: '100%',
                        }}
                      >
                        <img
                          src={previewDocument.file_url}
                          alt={previewDocument.file_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <iframe
                        src={previewDocument.file_url}
                        className="w-full h-full border rounded-lg"
                        title={previewDocument.file_name}
                      />
                    )
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => handleDownload(previewDocument?.file_url, previewDocument?.file_name)}
              >
                <Download className="mr-2 h-4 w-4" />
                Stiahnuť
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(false)}
              >
                Zavrieť
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDocuments;