import { Outlet, NavLink } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/state/authStore';
import { useNavigate } from 'react-router-dom';
import logo from '@/assets/Green-School_Brand_Green.webp';

const link = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'}`;

function LayoutInner(){
  const { state, signOut } = useAuth();
  const ready = state.status !== 'loading';
  const user = state.status === 'signedIn' ? state.user : null;
  const role = user?.role;
  const navigate = useNavigate();
  if(!ready) return null; // Avoid flicker
  const teacher = role === 'TEACHER';
  return (
    <div className="min-h-screen">
<header className="border-b">
  {/* remove fixed h-14; use padding so the bar grows with the logo */}
  <nav className="container flex items-center gap-3 py-3">
    <NavLink to="/" className="flex items-center">
      <img
        src={logo}
        alt="GreenSchool"
        className="h-12 md:h-14 w-auto object-contain"  // bigger logo
        loading="eager"
        decoding="async"
      />
      <span className="sr-only">GreenSchool</span>
    </NavLink>

    <Separator className="h-6" />

    <NavLink to="/" className={link}>Home</NavLink>
    {user && (teacher ? <NavLink to="/teachers" className={link}>Teachers</NavLink> : null)}
    {user && <NavLink to="/students" className={link}>Students</NavLink>}

    <div className="ml-auto flex gap-2 items-center">
      {!user && <NavLink to="/login" className={link}>Sign in</NavLink>}
      {user && (
        <button
          onClick={() => { signOut().finally(() => navigate('/login', { replace: true })); }}
          className="px-3 py-2 rounded-md text-sm bg-slate-100 hover:bg-slate-200"
        >
          Sign out
        </button>
      )}
    </div>
  </nav>
</header>
      <main className="container py-6">
        <Outlet />
      </main>
    </div>
  );
}

export default function AppLayout(){
  return <LayoutInner />;
}