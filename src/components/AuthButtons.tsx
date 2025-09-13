import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/auth/msal';
import { useNavigate } from 'react-router-dom';

export function AuthButtons(){
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const authed = accounts.length>0;
  return authed ? (
    <button onClick={()=> instance.logoutRedirect()} className="px-3 py-2 text-sm rounded-md bg-slate-200 hover:bg-slate-300">Sign out</button>
  ) : (
    <button onClick={()=> navigate('/login')} className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white hover:bg-slate-800">Sign in</button>
  );
}
