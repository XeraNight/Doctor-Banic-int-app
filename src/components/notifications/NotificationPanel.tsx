import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Calendar, MessageSquare, User, Info, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface NotificationPanelProps {
    notifications: NotificationItem[];
    onClose: () => void;
}

export const NotificationPanel = ({ notifications, onClose }: NotificationPanelProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const handleMarkAsRead = async (id: string) => {
        // If it's a persistent notification (UUID), update DB
        // If it's upcoming (prefix 'app-'), we can't really "mark as read" permanently unless we store that state.
        // For now, only DB notifications.
        if (!id.startsWith('app-')) {
            await supabase.from('notifications').update({ is_read: true }).eq('id', id);
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    };

    const handleMarkAllRead = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id);
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'appointment': return <Calendar className="h-4 w-4 text-blue-500" />;
            case 'message': return <MessageSquare className="h-4 w-4 text-green-500" />;
            case 'patient': return <User className="h-4 w-4 text-purple-500" />;
            case 'doctor': return <User className="h-4 w-4 text-orange-500" />;
            case 'mention': return <AlertCircle className="h-4 w-4 text-red-500" />;
            default: return <Info className="h-4 w-4 text-gray-500" />;
        }
    };

    const upcomingParams = notifications.filter(n => n.priority === 'high');
    const regularParams = notifications.filter(n => n.priority !== 'high');

    const handleItemClick = (n: NotificationItem) => {
        if (n.link) {
            navigate(n.link);
            onClose();
            if (!n.is_read) handleMarkAsRead(n.id);
        }
    };

    return (
        <div className="w-[340px] sm:w-[380px] max-w-[calc(100vw-32px)]">
            <div className="flex items-center justify-between p-4 border-b">
                <h4 className="font-semibold">Notifications</h4>
                {regularParams.some(n => !n.is_read) && (
                    <Button variant="ghost" size="sm" onClick={handleMarkAllRead} className="h-8 text-xs font-normal">
                        Mark all read
                    </Button>
                )}

            </div>

            <ScrollArea className="h-auto max-h-[60vh] min-h-[200px]">
                <div className="p-2 space-y-4">
                    {upcomingParams.length > 0 && (
                        <div className="space-y-2">
                            <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                                Happening Soon
                            </div>
                            {upcomingParams.map(n => (
                                <NotificationItemCard key={n.id} notification={n} icon={getIcon(n.type)} onClick={() => handleItemClick(n)} />
                            ))}
                        </div>
                    )}

                    {regularParams.length > 0 && (
                        <div className="space-y-2">
                            <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Recent
                            </div>
                            {regularParams.map(n => (
                                <NotificationItemCard key={n.id} notification={n} icon={getIcon(n.type)} onClick={() => handleItemClick(n)} onRead={() => handleMarkAsRead(n.id)} />
                            ))}
                        </div>
                    )}

                    {notifications.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground">
                            <p>No new notifications</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

const NotificationItemCard = ({ notification, icon, onClick, onRead }: { notification: NotificationItem, icon: React.ReactNode, onClick: () => void, onRead?: () => void }) => (
    <div
        className={`relative flex gap-3 p-3 rounded-lg hover:bg-accent cursor-pointer transition-colors ${!notification.is_read ? 'bg-accent/50' : ''}`}
        onClick={onClick}
    >
        <div className="mt-1 flex-shrink-0">
            {icon}
        </div>
        <div className="flex-1 space-y-1">
            <p className="text-sm font-medium leading-none">{notification.title}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
        </div>
        {!notification.is_read && onRead && (
            <Button
                variant="ghost"
                size="icon"
                className="p-0 border-none shadow-xl z-[100] text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onRead(); }}
            >
                <Check className="h-3 w-3" />
            </Button>
        )}
        {!notification.is_read && !onRead && (
            <div className="h-2 w-2 rounded-full bg-red-500 absolute top-3 right-3" />
        )}
    </div>
);
