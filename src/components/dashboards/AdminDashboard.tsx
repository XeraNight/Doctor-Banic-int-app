import { useState } from 'react';
import { Calendar, Users, FileText, Bell, LogOut, Menu, UserCog, Stethoscope, Briefcase, Settings, FolderOpen, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import CalendarWithNotes from '@/components/calendar/CalendarWithNotes';
import PatientList from '@/components/patients/PatientList';
import NotesPanel from '@/components/notes/NotesPanel';
// import NotificationCenter from '@/components/notifications/NotificationCenter';
import UserManagement from '@/components/users/UserManagement';
import AdminDocuments from '@/components/documents/AdminDocuments';
import ChatPanel from '@/components/chat/ChatPanel';

import { GlobalNotificationButton } from '@/components/notifications/GlobalNotificationButton';

const AdminDashboard = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'calendar' | 'patients' | 'users' | 'doctors' | 'employees' | 'documents' | 'notes' | 'chat'>('calendar');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'calendar', label: 'Termíny', icon: Calendar },
    { id: 'patients', label: 'Pacienti', icon: Users },
    { id: 'doctors', label: 'Lekári', icon: Stethoscope },
    { id: 'employees', label: 'Zamestnanci', icon: Briefcase },
    { id: 'users', label: 'Všetci používatelia', icon: UserCog },
    { id: 'documents', label: 'Dokumenty', icon: FolderOpen },
    { id: 'notes', label: 'Poznámky', icon: FileText },
    { id: 'chat', label: 'Pracovný chat', icon: MessageCircle },
  ];

  return (
    <div className="flex h-screen bg-transparent">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/10 bg-sidebar backdrop-blur-xl transition-all duration-300">
        <div className="p-6 border-b border-white/10">
          <img src="/logo.png" alt="Doktor Baník" className="h-12 w-auto mb-2" />
          <p className="text-sm text-sidebar-foreground/60 mt-1">Administrátorský panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={`w-full justify-start transition-all duration-200 border-0 ${activeTab === item.id
                ? 'sidebar-btn-active font-semibold'
                : 'text-sidebar-foreground/70 sidebar-btn-hover'
                }`}
              onClick={() => setActiveTab(item.id as any)}
            >
              <item.icon className={`mr-2 h-4 w-4 ${activeTab === item.id ? 'text-white' : 'text-sidebar-foreground/70'}`} />
              {item.label}
            </Button>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="mb-3 p-3 sidebar-btn-active rounded-lg border border-white/10 backdrop-blur-sm shadow-lg">
            <p className="text-sm font-medium truncate text-white">{user?.email}</p>
            <p className="text-xs text-white/80">Administrátor</p>
          </div>
          <Button variant="ghost" className="w-full justify-start sidebar-btn-active border-0 font-semibold" onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4 text-white" />
            Nastavenia
          </Button>
          <Button variant="ghost" className="w-full justify-start text-red-400 hover:bg-red-500/10 hover:text-red-500 border-0" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Odhlásiť sa
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-primary/90 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center justify-between p-4">
          <img src="/logo.png" alt="Doktor Baník" className="h-10 w-auto" />
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-white hover:bg-white/20">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        {mobileMenuOpen && (
          <nav className="p-4 space-y-2 border-t border-white/10 bg-primary/95 backdrop-blur-xl animate-fade-in">
            {menuItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                className={`w-full justify-start border-0 ${activeTab === item.id ? 'bg-accent text-accent-foreground' : 'text-white/80'}`}
                onClick={() => {
                  setActiveTab(item.id as any);
                  setMobileMenuOpen(false);
                }}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.label}
              </Button>
            ))}
            <Button variant="ghost" className="w-full justify-start text-white/80" onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Nastavenia
            </Button>
            <Button variant="ghost" className="w-full justify-start text-red-300" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Odhlásiť sa
            </Button>
          </nav>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background md:pt-0 pt-20 p-6">
        <div className="max-w-7xl mx-auto animate-fade-in">
          <div className="mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold text-white">
                {activeTab === 'calendar' && 'Správa termínov'}
                {activeTab === 'patients' && 'Správa pacientov'}
                {activeTab === 'doctors' && 'Správa lekárov'}
                {activeTab === 'employees' && 'Správa zamestnancov'}
                {activeTab === 'users' && 'Správa používateľov'}
                {activeTab === 'documents' && 'Správa dokumentov'}
                {activeTab === 'notes' && 'Poznámky a dokumentácia'}
                {activeTab === 'chat' && 'Pracovný chat'}
              </h2>
              <div className="ml-auto">
                <GlobalNotificationButton />
              </div>
            </div>
            <p className="text-white/80 mt-1">
              {activeTab === 'calendar' && 'Prezeranie a správa všetkých termínov'}
              {activeTab === 'patients' && 'Správa záznamov a histórie pacientov'}
              {activeTab === 'doctors' && 'Správa účtov a rozvrhov lekárov'}
              {activeTab === 'employees' && 'Správa účtov zamestnancov'}
              {activeTab === 'users' && 'Správa všetkých používateľov systému'}
              {activeTab === 'documents' && 'Prezeranie a správa dokumentov pacientov'}
              {activeTab === 'notes' && 'Administratívne a lekárske poznámky'}
              {activeTab === 'chat' && 'Tímová a súkromná komunikácia'}
            </p>
          </div>

          {activeTab === 'calendar' && <CalendarWithNotes viewType="admin" />}
          {activeTab === 'patients' && <PatientList />}
          {activeTab === 'doctors' && <UserManagement role="doctor" />}
          {activeTab === 'employees' && <UserManagement role="zamestnanec" />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'documents' && <AdminDocuments />}
          {activeTab === 'notes' && <NotesPanel />}
          {activeTab === 'chat' && (
            <div className="h-[calc(100vh-130px)]">
              <ChatPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
