import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Plus, Folder, FileText, Trash2, ChevronRight, Upload, GraduationCap, Briefcase, PartyPopper } from 'lucide-react';
import DOMPurify from 'dompurify';

type ProjectCategory = 'school' | 'work' | 'free_time';

interface ImportedFile {
  id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  is_route: boolean;
  route_path: string | null;
}

interface ImportedProject {
  id: string;
  name: string;
  description: string | null;
  category: ProjectCategory;
  created_at: string;
  files?: ImportedFile[];
}

const ProjectImport = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>('school');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ImportedProject | null>(null);
  
  // Form state - sanitized on submit
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectCategory, setProjectCategory] = useState<ProjectCategory>('school');
  const [fileStructure, setFileStructure] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['imported-projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imported_projects')
        .select(`
          *,
          files:imported_files(*)
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ImportedProject[];
    },
    enabled: !!user,
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      // Sanitize inputs - XSS protection
      const sanitizedName = DOMPurify.sanitize(projectName.trim());
      const sanitizedDescription = DOMPurify.sanitize(projectDescription.trim());
      
      if (!sanitizedName) {
        throw new Error('Project name is required');
      }

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('imported_projects')
        .insert({
          user_id: user?.id,
          name: sanitizedName,
          description: sanitizedDescription || null,
          category: projectCategory,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Parse and insert file structure if provided
      if (fileStructure.trim()) {
        const lines = fileStructure.split('\n').filter(line => line.trim());
        const files = lines.map(line => {
          const sanitizedLine = DOMPurify.sanitize(line.trim());
          const isRoute = sanitizedLine.startsWith('/') || sanitizedLine.includes('.html') || sanitizedLine.includes('.tsx') || sanitizedLine.includes('.jsx');
          const fileName = sanitizedLine.split('/').pop() || sanitizedLine;
          const fileType = fileName.includes('.') ? fileName.split('.').pop() : null;
          
          return {
            project_id: project.id,
            file_path: sanitizedLine,
            file_name: fileName,
            file_type: fileType,
            is_route: isRoute,
            route_path: isRoute ? sanitizedLine : null,
          };
        });

        if (files.length > 0) {
          const { error: filesError } = await supabase
            .from('imported_files')
            .insert(files);
          
          if (filesError) throw filesError;
        }
      }

      return project;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Project imported successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['imported-projects'] });
      resetForm();
      setIsDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await supabase
        .from('imported_projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Project deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['imported-projects'] });
      setSelectedProject(null);
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
    setProjectName('');
    setProjectDescription('');
    setProjectCategory('school');
    setFileStructure('');
  };

  const getCategoryIcon = (category: ProjectCategory) => {
    switch (category) {
      case 'school':
        return <GraduationCap className="h-5 w-5" />;
      case 'work':
        return <Briefcase className="h-5 w-5" />;
      case 'free_time':
        return <PartyPopper className="h-5 w-5" />;
    }
  };

  const getCategoryLabel = (category: ProjectCategory) => {
    switch (category) {
      case 'school':
        return 'School';
      case 'work':
        return 'Work';
      case 'free_time':
        return 'Free Time';
    }
  };

  const filteredProjects = projects?.filter(p => p.category === activeCategory) || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Project Import</h2>
          <p className="text-muted-foreground">Import and preview project folder structures</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground hover-lift">
              <Plus className="mr-2 h-4 w-4" />
              Import Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Import Project</DialogTitle>
              <DialogDescription>
                Add a new project with its folder structure for static preview.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My Awesome Project"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={projectCategory} onValueChange={(v) => setProjectCategory(v as ProjectCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">
                      <span className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" /> School
                      </span>
                    </SelectItem>
                    <SelectItem value="work">
                      <span className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4" /> Work
                      </span>
                    </SelectItem>
                    <SelectItem value="free_time">
                      <span className="flex items-center gap-2">
                        <PartyPopper className="h-4 w-4" /> Free Time
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  placeholder="Brief description of the project..."
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="files">File Structure (one path per line)</Label>
                <Textarea
                  id="files"
                  value={fileStructure}
                  onChange={(e) => setFileStructure(e.target.value)}
                  placeholder={`src/index.tsx\nsrc/App.tsx\nsrc/pages/Home.tsx\nsrc/components/Header.tsx`}
                  className="font-mono text-sm h-32"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => createProjectMutation.mutate()}
                  disabled={createProjectMutation.isPending || !projectName.trim()}
                  className="gradient-primary text-primary-foreground"
                >
                  {createProjectMutation.isPending ? 'Importing...' : 'Import Project'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as ProjectCategory)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="school" className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            School
          </TabsTrigger>
          <TabsTrigger value="work" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Work
          </TabsTrigger>
          <TabsTrigger value="free_time" className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4" />
            Free Time
          </TabsTrigger>
        </TabsList>

        {(['school', 'work', 'free_time'] as ProjectCategory[]).map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {isLoading ? (
                <Card className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ) : filteredProjects.length > 0 ? (
                filteredProjects.map((project) => (
                  <Card 
                    key={project.id} 
                    className="hover-lift cursor-pointer border-primary/20 hover:border-primary/50 transition-all animate-fade-in"
                    onClick={() => setSelectedProject(project)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(project.category)}
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this project?')) {
                              deleteProjectMutation.mutate(project.id);
                            }
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      {project.description && (
                        <CardDescription className="line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {project.files?.length || 0} files
                        <ChevronRight className="h-4 w-4 ml-auto" />
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-full">
                  <CardContent className="p-12 text-center">
                    <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No projects in {getCategoryLabel(category)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Import a project to get started
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Project Detail Dialog */}
      <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProject && getCategoryIcon(selectedProject.category)}
              {selectedProject?.name}
            </DialogTitle>
            {selectedProject?.description && (
              <DialogDescription>{selectedProject.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="mt-4">
            <h4 className="font-medium mb-3">File Structure (Static Preview)</h4>
            <div className="border rounded-lg bg-muted/50 p-4 font-mono text-sm space-y-1 max-h-64 overflow-y-auto">
              {selectedProject?.files && selectedProject.files.length > 0 ? (
                selectedProject.files.map((file) => (
                  <div 
                    key={file.id} 
                    className={`flex items-center gap-2 py-1 px-2 rounded ${
                      file.is_route ? 'bg-accent/10 text-accent' : ''
                    }`}
                  >
                    <FileText className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{file.file_path}</span>
                    {file.is_route && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        Route
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No files in this project</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Note: This is a static preview only. Backend functions are not executed.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectImport;
