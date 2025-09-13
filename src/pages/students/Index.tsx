import { useAuth } from '@/state/authStore';
import { NavLink } from 'react-router-dom';

export default function StudentsIndex(){
	const { state } = useAuth();
	if(state.status === 'loading') return null;
	if(state.status === 'signedOut') return <div className="p-6 space-y-2 text-sm"><p>Sign in required.</p><NavLink to="/login" className="underline">Sign in</NavLink></div>;
	const role = state.user.role;
	if(role !== 'TEACHER') return <div className="p-6 space-y-2 text-sm"><p>Teachers only.</p><p className="text-slate-500">You’re signed in as a student.</p></div>;
	return <div className="p-6 text-sm">{/* Teacher students table placeholder */}Students table here.</div>;
}