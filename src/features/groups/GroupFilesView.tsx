import { useParams } from "react-router-dom";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listGroupFiles, downloadUrl, archiveFile, purgeFile } from "@/lib/api/files";

export default function GroupFilesView(){
  const { groupId = "" } = useParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ACTIVE"|"ARCHIVED"|"ALL">("ACTIVE");
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["group-files", groupId, page, search, status],
    queryFn: () => listGroupFiles({ groupId, page, limit: 10, search, status }),
    enabled: !!groupId,
  });

  async function onArchive(id:string){ await archiveFile(id); qc.invalidateQueries({ queryKey:["group-files"] }); }
  async function onPurge(id:string){ if(!confirm("Permanently remove?")) return; await purgeFile(id); qc.invalidateQueries({ queryKey:["group-files"] }); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {(["ACTIVE","ARCHIVED","ALL"] as const).map(s=>(
          <button key={s} onClick={()=>{ setStatus(s); setPage(1); }} className={`px-3 py-1 rounded border ${status===s ? "bg-gray-100 font-semibold" : ""}`}>{s[0]+s.slice(1).toLowerCase()}</button>
        ))}
        <div className="ml-auto flex gap-2">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files…" className="border rounded px-3 py-1"/>
          <button className="border rounded px-3 py-1" onClick={()=>setPage(1)}>Search</button>
        </div>
      </div>

      {isLoading && <div>Loading…</div>}
      {isError && <div className="text-red-600">Failed to load files.</div>}

      {data && (
        <>
          <table className="min-w-full text-sm border rounded overflow-hidden">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-2 text-left">Name</th>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2 text-left">Uploaded</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {data.items.map(f=>(
                <tr key={f.id} className={`border-t ${f.status==="ARCHIVED"?"opacity-60":""}`}>
                  <td className="px-4 py-2">{f.name}</td>
                  <td className="px-4 py-2">{f.mimeType ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{typeof f.sizeBytes==="number" ? (f.sizeBytes/1024/1024).toFixed(2)+" MB" : "—"}</td>
                  <td className="px-4 py-2">{new Date(f.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <a href={downloadUrl(f.id)} className="underline">Download</a>
                    {f.status==="ACTIVE" && <button className="underline" onClick={()=>onArchive(f.id)}>Archive</button>}
                    <button className="underline text-red-600" onClick={()=>onPurge(f.id)}>Purge</button>
                  </td>
                </tr>
              ))}
              {data.items.length===0 && <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>No files</td></tr>}
            </tbody>
          </table>
          <div className="flex items-center justify-end gap-2">
            <button className="border rounded px-3 py-1" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
            <span>Page {data.page} / {data.pages}</span>
            <button className="border rounded px-3 py-1" disabled={page>=data.pages} onClick={()=>setPage(p=>Math.min(data.pages,p+1))}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}
