import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { RequireAuth, RequireRole } from '@/components/RequireRole';
import Home from '@/pages/Home';
import TeachersPage from '@/app/pages/teachers';
import StudentPortal from '@/pages/students/StudentPortal';
import LoginPage from '@/pages/Login';


const NotFound = () => (
  <div className="p-6">
    <h1 className="text-xl font-bold mb-2">404 Not Found</h1>
    <p>That page does not exist.</p>
  </div>
);

export const router = createBrowserRouter([
  // Public routes
  { path: '/', element: <AppLayout />, children: [ { index: true, element: <Home /> } ] },
  { path: '/login', element: <AppLayout />, children: [ { index: true, element: <LoginPage /> } ] },
  // Protected wrapper
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        element: <RequireAuth />, // protects the following nested routes
        children: [
          { path: 'teachers', element: <RequireRole allow="TEACHER"><TeachersPage /></RequireRole> },
          { path: 'students', element: <RequireRole allow="ANY"><StudentPortal /></RequireRole> },
        ]
      },
      { path: '*', element: <NotFound /> }
    ]
  }
]);