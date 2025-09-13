import { useMsal } from '@azure/msal-react';
import { useQuery } from '@tanstack/react-query';
import { getMe } from '@/lib/api';

export function useSession(){
  const { accounts } = useMsal();
  const enabled = accounts.length>0;
  const q = useQuery({ queryKey:['me'], queryFn: getMe, enabled });
  return { account: accounts[0], loading: q.isLoading, data: q.data as any, error: q.error as any };
}

export function useStudentPreview(){
  const { data } = useSession();
  const role = data?.role;
  return { preview: role==='TEACHER', editable: role==='STUDENT' };
}
