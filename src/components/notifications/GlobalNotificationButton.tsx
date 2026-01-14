import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationPanel } from './NotificationPanel';
import { useNotifications } from '@/hooks/useNotifications';
import { useState } from 'react';

export const GlobalNotificationButton = () => {
    const { notifications, unreadCount, isLoading } = useNotifications();
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="relative text-white/80 hover:text-white hover:bg-white/10 p-3">
                    <Bell className="h-8 w-8" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                side="bottom"
                sideOffset={12}
                className="w-auto p-0 border-none shadow-xl z-50"
                avoidCollisions={true}
                collisionPadding={16}
            >
                <NotificationPanel notifications={notifications} onClose={() => setOpen(false)} />
            </PopoverContent>
        </Popover>
    );
};
