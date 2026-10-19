import { Navigate, Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useWorkspace } from '../workspace/workspaceContext';

export default function ProtectedRoute() {
  const token = sessionStorage.getItem('accessToken');
  const {user,loading}=useWorkspace();
  const location=useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if(loading)return null;
  if(user?.role==='NOTICE_PUBLISHER'&&location.pathname!=='/updates')return <Navigate to="/updates" replace/>;
  return <Outlet />;
}
