import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import DoctorDashboard from '@/components/dashboards/DoctorDashboard';
import PatientDashboard from '@/components/dashboards/PatientDashboard';
import EmployeeDashboard from '@/components/dashboards/EmployeeDashboard';

const Dashboard = () => {
  const { userRole, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading your role...</p>
      </div>
    );
  }

  return (
    <>
      {userRole === 'admin' && <AdminDashboard />}
      {userRole === 'doctor' && <DoctorDashboard />}
      {userRole === 'patient' && <PatientDashboard />}
      {userRole === 'zamestnanec' && <EmployeeDashboard />}
    </>
  );
};

export default Dashboard;
