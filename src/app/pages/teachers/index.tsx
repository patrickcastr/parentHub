import { useState, useEffect } from 'react';
import { StudentsPanel } from './StudentsPanel'
import { GroupsPanel } from './GroupsPanel';

export default function TeachersPage() {
  const [tab, setTab] = useState<'students'|'groups'>(()=> (new URLSearchParams(window.location.search).get('tab') as any) || 'students');
  useEffect(()=>{
    const qs = new URLSearchParams(window.location.search); qs.set('tab', tab); window.history.replaceState(null,'',`?${qs.toString()}`);
  },[tab]);
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Teachers</h1>
      <div className="flex gap-2">
        <button onClick={()=>setTab('students')} className={`px-3 py-1 rounded ${tab==='students'?'bg-blue-600 text-white':'bg-gray-200'}`}>Students</button>
        <button onClick={()=>setTab('groups')} className={`px-3 py-1 rounded ${tab==='groups'?'bg-blue-600 text-white':'bg-gray-200'}`}>Groups</button>
      </div>
      {tab==='students'? <StudentsPanel /> : <GroupsPanel />}
    </div>
  );
}
