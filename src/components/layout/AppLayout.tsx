import { Outlet, NavLink } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`;

export default function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav className="container flex h-14 items-center gap-3">
          <NavLink to="/" className="font-semibold">GreenSchool</NavLink>
          <Separator orientation="vertical" className="h-6" />
          <NavLink to="/" className={link}>Home</NavLink>
            <NavLink to="/teachers/admin" className={link}>Teachers</NavLink>
          <NavLink to="/students" className={link}>Students</NavLink>
          <div className="ml-auto flex gap-2">
            <NavLink to="/signin" className={link}>Sign in</NavLink>
            <NavLink to="/register" className={link}>Register</NavLink>
          </div>
        </nav>
      </header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}