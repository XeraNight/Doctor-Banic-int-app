import { useState, useEffect } from 'react';
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
import { Plus, FileText, Save, Trash2, Edit2, X, GripVertical, Check, User, ChevronsUpDown } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Reorder, useDragControls } from 'framer-motion';

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
  const [recipientType, setRecipientType] = useState<'universal' | 'specific'>('universal');
  const [recipientName, setRecipientName] = useState('');
  
  // Filtering state
  const [filterRecipient, setFilterRecipient] = useState<string>('all');
  
  // Editing state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  
  // Combobox state
  const [openCombobox, setOpenCombobox] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: notes, isLoading } = useQuery({
    queryKey: ['notes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', user?.id)
        .order('order_index', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [orderedNotes, setOrderedNotes] = useState<any[]>([]);

  useEffect(() => {
    if (notes) {
      setOrderedNotes(notes);
    }
  }, [notes]);

  const filteredNotes = orderedNotes.filter(note => {
    if (filterRecipient === 'all') return true;
    if (filterRecipient === 'universal') return !note.recipient_name;
    return note.recipient_name === filterRecipient;
  });

  // Get unique recipients for filter
  const uniqueRecipients = Array.from(new Set(notes?.map(n => n.recipient_name).filter(Boolean) || []));

  const createNoteMutation = useMutation({
    mutationFn: async (noteData: any) => {
      // Get max order_index to put new note at the end (or specific logic)
      // For now, let's just use 0 or default. To put at top, we might want min index - 1.
      // Or simply: let's not worry about automatic ordering too much, dragged items will fix it.
      // But good UX: new items at top. So existing items should shift? 
      // Simpler: New items get order_index = 0, others act normally. 
      // We will handle reorder saves separately.
      
      const { data, error } = await supabase
        .from('notes')
        .insert({ ...noteData, order_index: 0 }) // Default to 0, might need robust logic if strictly ordered
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

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Úspech', description: 'Poznámka aktualizovaná' });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      setEditingNoteId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Chyba', description: error.message, variant: 'destructive' });
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
  
  const reorderMutation = useMutation({
    mutationFn: async (newOrder: any[]) => {
      const updates = newOrder.map((note, index) => ({
        id: note.id,
        order_index: index,
        user_id: user?.id, // RLS requirement usually
        title: note.title, // Required by type even if partial update? No, supabase update is partial.
        // Actually Supabase JS client handles partial updates well, but let's be safe.
      }));
      
      // Upsert might be better for batch updates if supported, 
      // but simple mapping with Promise.all is safer for now.
      await Promise.all(updates.map(u => 
        supabase.from('notes').update({ order_index: u.order_index }).eq('id', u.id)
      ));
    },
  });

  const handleReorder = (newOrder: any[]) => {
    setOrderedNotes(newOrder);
    // Debounce this in production? For now trigger immediately or on drag end.
    // Framer motion Reorder.Group onReorder triggers during drag.
    // We should probably save only after some time or manual save? 
    // Usually onReorder is state update, onDragEnd is persist. 
    // But Reorder component doesn't have onDragEnd easily exposed for the whole list order.
    // Let's just update local state and maybe fire mutation throttled or use a "Save Order" button?
    // Actually, Reorder updates state. We can use a useEffect or just fire mutation?
    // Let's fire mutation on every reorder for now, but that is heavy.
    // Better: Effect that runs when orderedNotes changes, debounced.
  };
  
  // Debounced save for order
  useEffect(() => {
    const handler = setTimeout(() => {
      if (notes && JSON.stringify(orderedNotes.map(n => n.id)) !== JSON.stringify(notes.map(n => n.id))) {
         reorderMutation.mutate(orderedNotes);
      }
    }, 1000);
    return () => clearTimeout(handler);
  }, [orderedNotes]);


  const resetForm = () => {
    setTitle('');
    setContent('');
    setCategory('medical');
    setNoteDate('');
    setRecipientType('universal');
    setRecipientName('');
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

    if (recipientType === 'specific' && !recipientName.trim()) {
      toast({
        title: 'Chyba',
        description: 'Prosím zadajte meno príjemcu',
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
      recipient_name: recipientType === 'specific' ? recipientName.trim() : null,
      is_draft: false,
    };

    createNoteMutation.mutate(noteData);
  };

  const startEditing = (note: any) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const saveEdit = (id: string) => {
    if (!editTitle.trim() || !editContent.trim()) return;
    updateNoteMutation.mutate({ id, title: editTitle, content: editContent });
  };
  
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'medical': return 'bg-primary text-primary-foreground';
      case 'administrative': return 'bg-accent text-accent-foreground';
      case 'reminder': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Poznámky</h3>
          <Button 
            size="sm" 
            onClick={() => setIsCreating(!isCreating)}
            className="bg-gradient-to-r from-[#3b82f6] to-[#1e3a8a] text-white hover:from-[#a3e635] hover:to-[#65a30d] transition-all duration-300 shadow-md border-0"
          >
            {isCreating ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {isCreating ? 'Zrušiť' : 'Nová poznámka'}
          </Button>
        </div>
        
        {/* Filter Dropdown */}
        <div className="flex items-center gap-2">
           <Select value={filterRecipient} onValueChange={setFilterRecipient}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filtrovať podľa príjemcu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky</SelectItem>
              <SelectItem value="universal">Univerzálne</SelectItem>
              {uniqueRecipients.map(name => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <Card className="animate-in fade-in slide-in-from-top-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nová poznámka</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                placeholder="Nadpis poznámky"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2">
                 {/* Recipient Toggle */}
                 <div className="col-span-2">
                    <div className="flex gap-4 mb-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input 
                                type="radio" 
                                checked={recipientType === 'universal'} 
                                onChange={() => setRecipientType('universal')} 
                                className="accent-primary"
                            />
                            Univerzálna
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input 
                                type="radio" 
                                checked={recipientType === 'specific'} 
                                onChange={() => setRecipientType('specific')} 
                                className="accent-primary"
                            />
                            Pre konkrétnu osobu
                        </label>
                    </div>
                    {recipientType === 'specific' && (
                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openCombobox}
                              className="w-full justify-between"
                            >
                              {recipientName
                                ? (profiles?.find((profile) => profile.full_name === recipientName)?.full_name || recipientName)
                                : "Vybrať osobu..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Vyhľadať osobu..." />
                              <CommandList>
                                <CommandEmpty>Žiadna osoba sa nenašla.</CommandEmpty>
                                <CommandGroup>
                                  {profiles?.map((profile) => (
                                    <CommandItem
                                      key={profile.id}
                                      value={profile.full_name}
                                      onSelect={(currentValue) => {
                                        setRecipientName(currentValue === recipientName ? "" : currentValue);
                                        setOpenCombobox(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          recipientName === profile.full_name ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {profile.full_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                    )}
                 </div>

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
                placeholder="Obsah poznámky..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={compact ? 3 : 5}
              />

              <Button type="submit" size="sm" className="w-full" disabled={createNoteMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                Uložiť poznámku
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center p-4 text-sm text-muted-foreground">Načítavam...</div>
        ) : filteredNotes.length > 0 ? (
          <Reorder.Group axis="y" values={orderedNotes} onReorder={handleReorder} className="space-y-3">
            {filteredNotes.map((note) => (
              <Reorder.Item key={note.id} value={note} className="list-none">
                <Card className={`hover:shadow-md transition-shadow group relative ${editingNoteId === note.id ? 'ring-2 ring-primary' : ''}`}>
                   
                  {editingNoteId === note.id ? (
                    // Editing Mode
                    <div className="p-4 space-y-3">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="font-bold" />
                        <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={3} />
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>Zrušiť</Button>
                            <Button size="sm" onClick={() => saveEdit(note.id)}><Save className="w-3 h-3 mr-1"/> Uložiť</Button>
                        </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                                <CardTitle className="text-sm font-medium leading-none mb-1.5 flex items-center gap-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity" />
                                    {note.title}
                                </CardTitle>
                                {note.recipient_name && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-6">
                                        <User className="h-3 w-3" />
                                        <span>Pre: {note.recipient_name}</span>
                                    </div>
                                )}
                            </div>
                            
                          <div className="flex items-center gap-1">
                             {/* Tools appear on hover */}
                            <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 hover:bg-primary/10 hover:text-primary transition-colors" 
                                    onClick={() => startEditing(note)}
                                >
                                    <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    onClick={() => deleteNoteMutation.mutate(note.id)}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                            
                            <Badge className={`${getCategoryColor(note.category)} text-[10px] px-1.5 py-0 h-5`}>
                              {note.category === 'medical' ? 'Lek' :
                                note.category === 'administrative' ? 'Admin' : 'Iné'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 ml-6">
                        <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{note.content}</p>
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-[10px] text-muted-foreground">
                            {format(new Date(note.created_at), 'd.M.yyyy')}
                            </p>
                            {note.note_date && (
                                <Badge variant="outline" className="text-[10px] h-4">
                                    {format(new Date(note.note_date), 'd.M.')}
                                </Badge>
                            )}
                        </div>
                      </CardContent>
                    </>
                  )}
                </Card>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        ) : (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Žiadne poznámky</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;

