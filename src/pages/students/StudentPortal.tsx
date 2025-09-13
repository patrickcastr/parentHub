import React from 'react';
import { useAuth } from '@/state/authStore';
import { fetchStudentPortal } from '@/lib/api/student';

function formatSize(bytes: number | null | undefined){
  if(!bytes || bytes <= 0) return '-';
  if(bytes < 1024) return bytes + ' B';
  const kb = bytes/1024; if(kb < 1024) return kb.toFixed(1)+' KB';
  const mb = kb/1024; if(mb < 1024) return mb.toFixed(1)+' MB';
  const gb = mb/1024; return gb.toFixed(1)+' GB';
}

export default function StudentPortal(){
  const { state } = useAuth();
  const ready = state.status !== 'loading';
  const user = state.status === 'signedIn' ? state.user : null;
  const role = user?.role;
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string|null>(null);
  const [group, setGroup] = React.useState<any>(null);
  const [files, setFiles] = React.useState<any[]>([]);

  React.useEffect(() => {
    if(!ready) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const data = await fetchStudentPortal();
        if(!cancelled){ setGroup(data.group); setFiles(data.files); }
      } catch (e:any){ if(!cancelled) setError(e.message || 'Failed to load'); }
      finally { if(!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [ready]);

  if(!ready) return null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Student Portal</h1>
        <p className="text-slate-600 text-sm">Welcome{user ? `, ${user.email}`: ''}. Access your group and shared files below.</p>
        {role === 'TEACHER' && <p className="text-xs text-amber-600">(Viewing as teacher.)</p>}
      </header>

      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-medium mb-2">My Group</h2>
        {loading ? <p className="text-sm text-slate-500">Loading group...</p> : (
          group ? (
            <div className="text-sm space-y-1">
              <p><span className="font-medium">Name:</span> {group.name}</p>
              {group.startsOn && <p><span className="font-medium">Starts:</span> {new Date(group.startsOn).toLocaleDateString()}</p>}
              {group.endsOn && <p><span className="font-medium">Ends:</span> {new Date(group.endsOn).toLocaleDateString()}</p>}
            </div>
          ) : <p className="text-sm text-slate-500">Not assigned to a group yet.</p>
        )}
      </section>

      <section className="border rounded-lg p-4 bg-white shadow-sm">
        <h2 className="text-lg font-medium mb-3">Files I Can Download</h2>
        {loading && <p className="text-sm text-slate-500">Loading files...</p>}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        {!loading && !error && files.length === 0 && <p className="text-sm text-slate-500">No files yet.</p>}
        {!loading && !error && files.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="text-left px-3 py-2 border-b">Name</th>
                  <th className="text-left px-3 py-2 border-b">Size</th>
                  <th className="text-left px-3 py-2 border-b">Uploaded</th>
                  <th className="text-left px-3 py-2 border-b">Uploaded By</th>
                  <th className="px-3 py-2 border-b">Action</th>
                </tr>
              </thead>
              <tbody>
                {files.map(f => (
                  <tr key={f.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 border-b font-medium text-slate-800">{f.name}</td>
                    <td className="px-3 py-2 border-b">{formatSize(f.sizeBytes)}</td>
                    <td className="px-3 py-2 border-b">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2 border-b">{f.uploadedBy || '-'}</td>
                    <td className="px-3 py-2 border-b text-center">
                      <button
                        onClick={() => { window.location.href = `/api/files/${f.id}/download`; }}
                        className="inline-flex items-center px-3 py-1.5 rounded-md bg-slate-900 text-white hover:bg-slate-800 text-xs"
                      >Download</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}