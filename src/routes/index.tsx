import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Home from '@/pages/Home';
import TeacherAdmin from '@/pages/teachers/Admin';
import Students from '@/pages/students/Index';
import SignIn from '@/pages/auth/SignIn';
import Register from '@/pages/auth/Register';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'teachers/admin', element: <TeacherAdmin /> },
      { path: 'students', element: <Students /> },
      { path: 'signin', element: <SignIn /> },
      { path: 'register', element: <Register /> }
    ]
  }
]);