import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listGroups, createGroup, deleteGroup } from '@/lib/api';
import { useState } from 'react';
import GroupFilesModal from '@/components/GroupFilesModal';

export default function Groups() {
	const qc = useQueryClient();
	const [search, setSearch] = useState('');
	const [page, setPage] = useState(1);
	const [name, setName] = useState('');
	const [filesGroupId,setFilesGroupId] = useState<string|null>(null);
	const limit = 10;
	const { data, isLoading, isError, error } = useQuery({
		queryKey: ['groups', { search, page, limit }],
		queryFn: () => listGroups({ search, page, limit }),
	});

	const createMut = useMutation({
		mutationFn: () => createGroup({ name, startsOn: null }),
		onSuccess: () => {
			setName('');
			qc.invalidateQueries({ queryKey: ['groups'] });
		},
	});
	const delMut = useMutation({
		mutationFn: (id: string) => deleteGroup(id),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
	});

	return (
	<>
		<section className="p-4 space-y-4">
			<h1 className="text-xl font-semibold">Groups</h1>
			<div className="flex gap-2 items-end flex-wrap">
				<div className="flex flex-col">
					<label className="text-xs font-medium">Search</label>
					<input
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						placeholder="Search groups"
						className="border rounded px-2 py-1"
					/>
				</div>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						if (!name.trim()) return;
						createMut.mutate();
					}}
					className="flex gap-2 items-end"
				>
					<div className="flex flex-col">
						<label className="text-xs font-medium">New group name</label>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Name"
							className="border rounded px-2 py-1"
						/>
					</div>
					<button
						disabled={createMut.isPending}
						className="bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
					>
						Create
					</button>
				</form>
			</div>
			{isLoading && <div>Loading…</div>}
			{isError && (
				<div className="text-red-600 text-sm">
					Error: {(error as any)?.message}
				</div>
			)}
			{data && (
				<>
					<table className="w-full text-sm border">
						<thead>
							<tr className="bg-gray-50 text-left">
								<th className="p-2 border">Name</th>
								<th className="p-2 border">Members</th>
								<th className="p-2 border">Files</th>
								<th className="p-2 border">Starts</th>
								<th className="p-2 border">Created</th>
								<th className="p-2 border">Actions</th>
							</tr>
						</thead>
						<tbody>
							{data.items.map((g: any) => (
								<tr key={g.id} className="hover:bg-gray-50">
									<td className="p-2 border font-medium">{g.name}</td>
										<td className="p-2 border">{g.members ?? '—'}</td>
										<td className="p-2 border">{g.files ?? '—'}</td>
									<td className="p-2 border">
										{g.startsOn ? (()=>{ const d = new Date(g.startsOn!); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(); })() : '—'}
									</td>
									<td className="p-2 border">
										{g.createdAt ? (()=>{ const d=new Date(g.createdAt); return isNaN(d.getTime())?'—': d.toLocaleDateString(); })() : '—'}
									</td>
									<td className="p-2 border">
										<button
											onClick={() => delMut.mutate(g.id)}
											disabled={delMut.isPending}
											className="text-red-600 hover:underline mr-3"
										>
											Delete
										</button>
              <button onClick={()=> setFilesGroupId(g.id)} className="text-blue-600 hover:underline">View Files</button>
						</td>
								</tr>
							))}
							{!data.items.length && (
								<tr>
									<td
										colSpan={6}
										className="p-4 text-center text-muted-foreground"
									>
										No groups yet.
									</td>
								</tr>
							)}
						</tbody>
					</table>
					<div className="flex justify-between items-center pt-2">
						<div className="text-xs text-muted-foreground">
							Total: {data.total}
						</div>
						<div className="flex gap-2">
							<button
								disabled={page <= 1}
								onClick={() => setPage((p) => p - 1)}
								className="px-2 py-1 border rounded disabled:opacity-40"
							>
								Prev
							</button>
							<div className="px-2 py-1 text-sm">Page {page}</div>
							<button
								disabled={data.items.length < limit}
								onClick={() => setPage((p) => p + 1)}
								className="px-2 py-1 border rounded disabled:opacity-40"
							>
								Next
							</button>
						</div>
					</div>
				</>
			)}
		</section>
	  <GroupFilesModal open={!!filesGroupId} onOpenChange={(v)=> !v && setFilesGroupId(null)} groupId={filesGroupId} />
	</>
)
}