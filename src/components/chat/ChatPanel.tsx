import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Plus, Users, User, Paperclip, MoreVertical, Settings, Trash2, FileText, Download, LogOut, UserPlus, Smile } from 'lucide-react';
import { format } from 'date-fns';
import DOMPurify from 'dompurify';
import { Label } from '@/components/ui/label';

interface ChatRoom {
  id: string;
  name: string | null;
  is_team_chat: boolean;
  created_at: string;
  created_by: string;
}

interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; email: string };
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
  mentions?: string[];
}

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡", "🎉", "🔥", "👀", "✅", "❌", "🙏", "🤝", "👋", "🤔", "😎", "🙌", "💯", "🚀", "✨"];

const ChatPanel = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [isTeamChat, setIsTeamChat] = useState(false);
  const [chatName, setChatName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Mention State
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(-1);

  // Edit & Delete & Member State
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [showManageMembersDialog, setShowManageMembersDialog] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [usersToAdd, setUsersToAdd] = useState<string[]>([]);

  // Fetch chat rooms
  const { data: rooms, isLoading: roomsLoading } = useQuery({
    queryKey: ['chat-rooms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_rooms')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ChatRoom[];
    },
    enabled: !!user,
  });

  // Fetch messages for selected room
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['chat-messages', selectedRoom],
    queryFn: async () => {
      if (!selectedRoom) return [];
      const { data: messagesData, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', selectedRoom)
        .order('created_at', { ascending: true });
      if (error) throw error;

      // Fetch sender profiles separately
      const senderIds = [...new Set(messagesData.map(m => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return messagesData.map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id),
      })) as ChatMessage[];
    },
    enabled: !!selectedRoom,
  });

  // Fetch current room members (for Add Member exclusion & Mentions)
  const { data: roomMembers, isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ['chat-members', selectedRoom],
    queryFn: async () => {
      if (!selectedRoom) return [];

      // Step 1: Get member user_ids
      const { data: memberData, error: memberError } = await supabase
        .from('chat_room_members')
        .select('user_id')
        .eq('room_id', selectedRoom);

      if (memberError) {
        console.error('Error fetching room members:', memberError);
        throw memberError;
      }

      if (!memberData || memberData.length === 0) {
        console.log('No members found in chat_room_members');
        return [];
      }

      const userIds = memberData.map(m => m.user_id);
      console.log('Member user IDs:', userIds);

      // Step 2: Get profiles for those user_ids
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        throw profileError;
      }

      console.log('Room members profiles:', profileData);
      return profileData || [];
    },
    enabled: !!selectedRoom
  });

  // Fetch all users for creating chats (and adding members)
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-chat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .neq('id', user?.id);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Real-time subscription for messages
  useEffect(() => {
    if (!selectedRoom) return;

    const channel = supabase
      .channel(`room-${selectedRoom}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${selectedRoom}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedRoom] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRoom, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Create room mutation
  const createRoomMutation = useMutation({
    mutationFn: async () => {
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({
          name: chatName || (isTeamChat ? 'Team Chat' : 'Private Chat'),
          is_team_chat: isTeamChat,
          created_by: user?.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      await supabase.from('chat_room_members').insert({
        room_id: room.id,
        user_id: user?.id,
      });

      for (const userId of selectedUsers) {
        await supabase.from('chat_room_members').insert({
          room_id: room.id,
          user_id: userId,
        });
      }

      return room;
    },
    onSuccess: (room) => {
      toast({ title: 'Success', description: 'Chat created successfully' });
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      setSelectedRoom(room.id);
      setShowNewChatDialog(false);
      setChatName('');
      setSelectedUsers([]);
      setIsTeamChat(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Add Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) return;

      // Get profiles of users being added for system messages
      const { data: newMemberProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', usersToAdd);

      // Insert members
      const inserts = usersToAdd.map(uid => ({
        room_id: selectedRoom,
        user_id: uid
      }));
      const { error } = await supabase.from('chat_room_members').insert(inserts);
      if (error) throw error;

      // Send system message for each added member
      if (newMemberProfiles) {
        for (const profile of newMemberProfiles) {
          await supabase.from('chat_messages').insert({
            room_id: selectedRoom,
            sender_id: user?.id,
            content: `${profile.full_name} was added to the chat`,
            attachment_type: 'system'
          });
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Members added successfully' });
      queryClient.invalidateQueries({ queryKey: ['chat-members', selectedRoom] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedRoom] });
      setShowAddMemberDialog(false);
      setUsersToAdd([]);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Leave Chat Mutation
  const leaveChatMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom || !user) return;

      // 1. Send system message
      await supabase.from('chat_messages').insert({
        room_id: selectedRoom,
        sender_id: user.id,
        content: `${user.user_metadata?.full_name || 'A user'} left the chat`,
        attachment_type: 'system'
      });

      // 2. Remove self from members
      const { error } = await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', selectedRoom)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Left Chat', description: 'You have left the chat' });
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      setSelectedRoom(null);
      setShowLeaveAlert(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Remove Member Mutation (Admin Only)
  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!selectedRoom) return;

      // 1. Send system message
      const memberProfile = roomMembers?.find((m: any) => m.id === memberId);
      await supabase.from('chat_messages').insert({
        room_id: selectedRoom,
        sender_id: user?.id,
        content: `${memberProfile?.full_name || 'User'} was removed by admin`,
        attachment_type: 'system'
      });

      // 2. Remove member
      const { error } = await supabase
        .from('chat_room_members')
        .delete()
        .eq('room_id', selectedRoom)
        .eq('user_id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Member removed' });
      queryClient.invalidateQueries({ queryKey: ['chat-members', selectedRoom] });
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedRoom] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Send message mutation (handles text, files, mentions)
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, attachment, mentions }: { content: string, attachment?: { url: string, type: string, name: string }, mentions?: string[] }) => {
      const sanitizedContent = DOMPurify.sanitize(content.trim());

      // Don't send if empty AND no attachment
      if (!sanitizedContent && !attachment) return;

      const { error } = await supabase.from('chat_messages').insert({
        room_id: selectedRoom,
        sender_id: user?.id,
        content: sanitizedContent,
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
        attachment_name: attachment?.name,
        mentions: mentions || []
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['chat-messages', selectedRoom] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Rename Chat Query
  const renameChatMutation = useMutation({
    mutationFn: async (newName: string) => {
      if (!selectedRoom) throw new Error('No room selected');
      const { error } = await supabase
        .from('chat_rooms')
        .update({ name: newName })
        .eq('id', selectedRoom);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Chat renamed' });
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      setShowEditDialog(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete Chat Query
  const deleteChatMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRoom) throw new Error('No room selected');
      const { error } = await supabase
        .from('chat_rooms')
        .delete()
        .eq('id', selectedRoom);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Chat deleted' });
      queryClient.invalidateQueries({ queryKey: ['chat-rooms'] });
      setSelectedRoom(null);
      setShowDeleteAlert(false);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Handle Input with Mention Detection
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    const lastAtPos = val.lastIndexOf('@');
    if (lastAtPos !== -1) {
      // Check if @ is preceded by space or is start of string
      if (lastAtPos === 0 || val[lastAtPos - 1] === ' ') {
        const query = val.slice(lastAtPos + 1);
        // Only show if query doesn't contain space (searching username)
        if (!query.includes(' ')) {
          setMentionQuery(query);
          setMentionIndex(lastAtPos);
          setShowMentionList(true);
          return;
        }
      }
    }
    setShowMentionList(false);
  };

  const handleMentionSelect = (userId: string, userName: string) => {
    if (mentionIndex === -1) return;
    const before = newMessage.slice(0, mentionIndex);
    const after = newMessage.slice(mentionIndex + mentionQuery.length + 1);
    setNewMessage(`${before}@${userName} ${after}`);
    setShowMentionList(false);
    inputRef.current?.focus();
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newMessage.trim() || isUploading) {
      // Extract mentions from final text (simple check if @Name exists)
      const mentions: string[] = [];
      roomMembers?.forEach((m: any) => {
        if (newMessage.includes(`@${m.full_name}`)) {
          mentions.push(m.id);
        }
      });

      sendMessageMutation.mutate({ content: newMessage, mentions });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedRoom) return;

    setIsUploading(true);
    try {
      // 1. Upload file
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedRoom}/${Math.random()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName);

      // 3. Determine type
      let type = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type === 'application/pdf') type = 'pdf';

      // 4. Send Message with attachment
      await sendMessageMutation.mutateAsync({
        content: '', // Can be empty if just sending file
        attachment: {
          url: publicUrl,
          type: type,
          name: file.name
        }
      });

    } catch (error: any) {
      toast({ title: 'Upload Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Helper to init edit dialog
  const openEditDialog = () => {
    const room = rooms?.find(r => r.id === selectedRoom);
    if (room) {
      setEditingName(room.name || '');
      setShowEditDialog(true);
    }
  };

  const renderAttachment = (msg: ChatMessage) => {
    if (!msg.attachment_url) return null;

    const isMe = msg.sender_id === user?.id;
    const bgColor = isMe ? 'bg-primary-foreground/10' : 'bg-primary/10'; // slight contrast for file bubble

    if (msg.attachment_type === 'image') {
      return (
        <div className="mt-2 text-center">
          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
            <img
              src={msg.attachment_url}
              alt={msg.attachment_name || 'Image'}
              className="max-w-[200px] max-h-[200px] rounded-md object-cover border border-border/50 hover:opacity-90 transition-opacity"
            />
          </a>
        </div>
      );
    }

    if (msg.attachment_type === 'video') {
      return (
        <div className="mt-2">
          <video
            src={msg.attachment_url}
            controls
            className="max-w-[240px] rounded-md border border-border/50"
          />
        </div>
      );
    }

    return (
      <a
        href={msg.attachment_url}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 mt-2 p-2 rounded-md ${bgColor} hover:bg-opacity-80 transition-all text-xs border border-border/20`}
      >
        <FileText className="h-4 w-4 opacity-70" />
        <span className="truncate max-w-[150px] underline decoration-dotted">{msg.attachment_name || 'Attachment'}</span>
        <Download className="h-3 w-3 opacity-50 ml-auto" />
      </a>
    );
  };

  return (
    <div className="flex h-full gap-4">
      {/* Room List */}
      <Card className="w-64 flex-shrink-0">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">Chats</CardTitle>
            <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-6 w-6">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Chat</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <Input
                    placeholder="Chat name (optional)"
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant={!isTeamChat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsTeamChat(false)}
                    >
                      <User className="mr-2 h-4 w-4" />
                      Private
                    </Button>
                    <Button
                      variant={isTeamChat ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setIsTeamChat(true)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Team
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-auto">
                    <p className="text-sm text-muted-foreground">Select participants:</p>
                    {allUsers?.map((u) => (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all border ${selectedUsers.includes(u.id)
                          ? 'bg-primary/10 border-primary shadow-sm'
                          : 'hover:bg-accent border-transparent'
                          }`}
                        onClick={() => {
                          if (!isTeamChat) {
                            // Private mode: Single select
                            setSelectedUsers(prev => prev.includes(u.id) ? [] : [u.id]);
                          } else {
                            // Team mode: Multi select
                            setSelectedUsers(prev =>
                              prev.includes(u.id)
                                ? prev.filter(id => id !== u.id)
                                : [...prev, u.id]
                            );
                          }
                        }}
                      >
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${selectedUsers.includes(u.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                          }`}>
                          {selectedUsers.includes(u.id) && <div className="h-2 w-2 rounded-full bg-white" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                          <p className="text-xs text-muted-foreground truncate opacity-70">{u.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={() => createRoomMutation.mutate()}
                    disabled={selectedUsers.length === 0 || createRoomMutation.isPending}
                    className="w-full"
                  >
                    Create Chat
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[400px]">
            {roomsLoading ? (
              <p className="text-sm text-muted-foreground text-center p-4">Loading...</p>
            ) : rooms && rooms.length > 0 ? (
              <div className="space-y-1">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className={`p-2 rounded cursor-pointer transition-colors ${selectedRoom === room.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                      }`}
                    onClick={() => setSelectedRoom(room.id)}
                  >
                    <div className="flex items-center gap-2">
                      {room.is_team_chat ? (
                        <Users className="h-4 w-4" />
                      ) : (
                        <MessageCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium truncate">
                        {room.name || 'Unnamed Chat'}
                      </span>
                    </div>
                    {room.is_team_chat && (
                      <Badge variant="secondary" className="text-xs mt-1">Team</Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4">
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No chats yet</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col">
        {selectedRoom ? (
          <>
            <CardHeader className="pb-3 border-b flex flex-row justify-between items-center space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                {rooms?.find(r => r.id === selectedRoom)?.name || 'Chat'}
                <div className="flex -space-x-2 ml-2">
                  {roomMembers?.slice(0, 3).map((m: any) => (
                    <div key={m.id} className="h-6 w-6 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-[10px] overflow-hidden" title={m.full_name}>
                      {m.full_name.slice(0, 2).toUpperCase()}
                    </div>
                  ))}
                  {(roomMembers?.length || 0) > 3 && (
                    <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px]">
                      +{roomMembers.length - 3}
                    </div>
                  )}
                </div>
              </CardTitle>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setUsersToAdd([]); setShowAddMemberDialog(true); }}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Member
                  </DropdownMenuItem>

                  {userRole === 'admin' && (
                    <DropdownMenuItem onClick={() => setShowManageMembersDialog(true)}>
                      <Users className="mr-2 h-4 w-4" />
                      Manage Members
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={openEditDialog}>
                    <Settings className="mr-2 h-4 w-4" />
                    Rename Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowLeaveAlert(true)} className="text-orange-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowDeleteAlert(true)} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Chat
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="flex-1 p-0 flex flex-col">
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messagesLoading ? (
                    <p className="text-sm text-muted-foreground text-center">Loading messages...</p>
                  ) : messages && messages.length > 0 ? (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.attachment_type === 'system' ? (
                          <div className="w-full flex justify-center my-2">
                            <span className="text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full">
                              {msg.content}
                            </span>
                          </div>
                        ) : (
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${msg.sender_id === user?.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-accent text-accent-foreground'
                              }`}
                          >
                            {msg.sender_id !== user?.id && (
                              <p className="text-xs font-medium mb-1 opacity-80">
                                {msg.sender?.full_name || 'Unknown'}
                              </p>
                            )}
                            {msg.content && <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>}

                            {/* Attachment Render */}
                            {renderAttachment(msg)}

                            <p className="text-xs opacity-70 mt-1 text-right">
                              {format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center">No messages yet</p>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="p-4 border-t flex gap-2 items-center relative">
                {/* Mention Popover */}
                {showMentionList && (
                  <div className="absolute bottom-16 left-12 w-48 bg-popover border rounded-md shadow-md z-50 animate-in fade-in slide-in-from-bottom-2">
                    <Command>
                      <CommandList>
                        <CommandGroup heading="Mention member">
                          {roomMembers?.filter((m: any) =>
                            m.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
                          ).map((m: any) => (
                            <CommandItem key={m.id} onSelect={() => handleMentionSelect(m.id, m.full_name)} className="cursor-pointer">
                              <User className="mr-2 h-3 w-3" />
                              {m.full_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,video/*,application/pdf"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || sendMessageMutation.isPending}
                >
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="shrink-0">
                      <Smile className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2">
                    <div className="grid grid-cols-5 gap-1">
                      {COMMON_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          className="text-xl hover:bg-muted p-1 rounded"
                          onClick={() => setNewMessage(prev => prev + emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder={isUploading ? "Uploading..." : "Type @ to mention..."}
                    value={newMessage}
                    onChange={handleInputChange}
                    className="flex-1"
                    disabled={isUploading}
                    autoComplete="off"
                  />
                  <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || isUploading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Select a chat or create a new one</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Manage Members Dialog (Admin Only) */}
      <Dialog open={showManageMembersDialog} onOpenChange={setShowManageMembersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2 max-h-60 overflow-auto">
              {membersLoading ? (
                <p className="text-sm text-center py-4 text-muted-foreground">Loading members...</p>
              ) : membersError ? (
                <div className="text-sm text-center py-4">
                  <p className="text-red-600 mb-2">Error loading members</p>
                  <p className="text-xs text-muted-foreground">{membersError.message}</p>
                </div>
              ) : !roomMembers || roomMembers.length === 0 ? (
                <p className="text-sm text-center py-4 text-muted-foreground">No members found</p>
              ) : (
                roomMembers.map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between p-2 hover:bg-muted rounded-md border">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">
                        {m.full_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.full_name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    {/* Admins can remove anyone EXCEPT themselves (use Leave Chat for that) */}
                    {user?.id !== m.id && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeMemberMutation.mutate(m.id)}
                        disabled={removeMemberMutation.isPending}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowManageMembersDialog(false)}>Close</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Chat Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Chat Name</Label>
              <Input
                id="name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
              <Button onClick={() => renameChatMutation.mutate(editingName)} disabled={renameChatMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Members to Chat</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2 max-h-48 overflow-auto">
              <p className="text-sm text-muted-foreground">Select users to add:</p>
              {allUsers?.filter(u => !roomMembers?.some((m: any) => m.id === u.id)).length === 0 ? (
                <p className="text-sm text-center py-4">All available users are already in this chat.</p>
              ) : (
                allUsers?.filter(u => !roomMembers?.some((m: any) => m.id === u.id)).map(u => (
                  <div
                    key={u.id}
                    className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all border ${usersToAdd.includes(u.id)
                      ? 'bg-primary/10 border-primary shadow-sm'
                      : 'hover:bg-accent border-transparent'
                      }`}
                    onClick={() => {
                      setUsersToAdd(prev =>
                        prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                      );
                    }}
                  >
                    <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${usersToAdd.includes(u.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                      }`}>
                      {usersToAdd.includes(u.id) && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{u.full_name || u.email}</p>
                      <p className="text-xs text-muted-foreground truncate opacity-70">{u.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>Cancel</Button>
              <Button
                onClick={() => addMemberMutation.mutate()}
                disabled={usersToAdd.length === 0 || addMemberMutation.isPending}
              >
                Add Members
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave Chat Confirmation */}
      <AlertDialog open={showLeaveAlert} onOpenChange={setShowLeaveAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this chat? You won't receive new messages unless someone adds you back.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => leaveChatMutation.mutate()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Leave Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Chat Confirmation */}
      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the chat room and all messages for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteChatMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatPanel;
