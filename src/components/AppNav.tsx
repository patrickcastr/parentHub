import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/useSession';
import logo from '../../assets/Green-School_Brand_Green.webp';

export function AppNav() {
  const { data } = useSession();
  const role = data?.role;
  return (
    <nav className="flex gap-2 p-4 border-b bg-background">
      <Button asChild variant="outline"><NavLink to="/">Home</NavLink></Button>
  {role==='TEACHER' && <Button asChild variant="outline"><NavLink to="/teachers">Teachers</NavLink></Button>}
  {role==='TEACHER' && <Button asChild variant="outline"><NavLink to="/students">Students (preview)</NavLink></Button>}
      {role==='student' && <Button asChild variant="outline"><NavLink to="/students">Students</NavLink></Button>}
    </nav>
  );
}
