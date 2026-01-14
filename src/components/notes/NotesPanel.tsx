import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, FileText, Save, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface NotesPanelProps {
  compact?: boolean;
}

const NotesPanel = ({ compact = false }: NotesPanelProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'administrative' | 'medical' | 'reminder'>('medical');
  const [noteDate, setNoteDate] = useState('');

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      const { data, error } = await supabase
        .from('notes')
        .insert(noteData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Poznámka úspešne uložená',
      });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
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

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Úspech',
        description: 'Poznámka bola vymazaná',
      });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
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
    setTitle('');
    setContent('');
    setCategory('medical');
    setNoteDate('');
    setIsCreating(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Chyba',
        description: 'Prosím vyplňte nadpis a obsah',
        variant: 'destructive',
      });
      return;
    }

    const noteData = {
      user_id: user?.id,
      title: title.trim(),
      content: content.trim(),
      category,
      note_date: noteDate || null,
      is_draft: false,
    };

    createNoteMutation.mutate(noteData);
  };

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'medical':
        return 'bg-primary text-primary-foreground';
      case 'administrative':
        return 'bg-accent text-accent-foreground';
      case 'reminder':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Poznámky</h3>
          <Button size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-2 h-4 w-4" />
            Nová poznámka
          </Button>
        </div>
      )}

      {/* Create Note Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Nová poznámka</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Nadpis poznámky"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Select value={category} onValueChange={(value: any) => setCategory(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="medical">Lekárske</SelectItem>
                    <SelectItem value="administrative">Administratívne</SelectItem>
                    <SelectItem value="reminder">Pripomienka</SelectItem>
                  </SelectContent>
                </Select>

                <Input
                  type="date"
                  value={noteDate}
                  onChange={(e) => setNoteDate(e.target.value)}
                />
              </div>

              <Textarea
                placeholder="Sem napíšte svoju poznámku..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={compact ? 4 : 6}
              />

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={createNoteMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  Uložiť poznámku
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Zrušiť
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {isLoading ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-center text-sm text-muted-foreground">Načítavam poznámky...</p>
            </CardContent>
          </Card>
        ) : notes && notes.length > 0 ? (
          notes.slice(0, compact ? 3 : undefined).map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-sm font-medium">{note.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge className={getCategoryColor(note.category)}>
                      {note.category === 'medical' ? 'Lekárske' :
                        note.category === 'administrative' ? 'Administratívne' :
                          note.category === 'reminder' ? 'Pripomienka' : note.category}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm('Naozaj chcete vymazať túto poznámku?')) {
                          deleteNoteMutation.mutate(note.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {note.note_date && (
                  <CardDescription className="text-xs">
                    {format(new Date(note.note_date), 'PP')}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-3">
                <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {format(new Date(note.created_at), 'PPp')}
                </p>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Zatiaľ žiadne poznámky</p>
                {!compact && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-2"
                    onClick={() => setIsCreating(true)}
                  >
                    Vytvoriť prvú poznámku
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
