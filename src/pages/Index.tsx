import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/auth');
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-medical-blue-light via-background to-background">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
          <Activity className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mb-4 text-4xl font-bold text-primary">Doktor Baník</h1>
        <p className="text-xl text-muted-foreground">Medical Practice Management</p>
      </div>
    </div>
  );
};

export default Index;
