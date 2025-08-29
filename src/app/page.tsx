'use client';

import { useEffect, useState } from 'react';

interface Cohort {
  id: string;
  name: string;
  expiresAt?: string;
}

interface Student {
  studentId: string;
  name: string;
  username: string;
  age: number;
  email: string;
  group: string;
}

export default function AdminPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [newName, setNewName] = useState('');
  const [expiry, setExpiry] = useState('');

  async function loadData() {
    const res = await fetch('/api/cohorts');
    if (res.ok) {
      const data = await res.json();
      setCohorts(data.cohorts || []);
    }
    const res2 = await fetch('/api/students/list');
    if (res2.ok) {
      const data2 = await res2.json();
      setStudents(data2.students || []);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createCohort(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/cohorts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, expiresAt: expiry })
    });
    if (res.ok) {
      setNewName('');
      setExpiry('');
      loadData();
    }
  }

  async function importCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const cohortId = cohorts[0]?.id;
    if (!cohortId) return;
    const res = await fetch(`/api/students/upsert?cohortId=${encodeURIComponent(cohortId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/csv' },
      body: text
    });
    if (res.ok) {
      loadData();
    }
  }

  return (
    <div>
      <h1>Admin</h1>
      <h2>Create a new group</h2>
      <form onSubmit={createCohort}>
        <label>
          Name: <input value={newName} onChange={e => setNewName(e.target.value)} required />
        </label>
        <label>
          Expiry date: <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} />
        </label>
        <button type="submit">Create</button>
      </form>
      <h2>Import students (CSV)</h2>
      <input type="file" accept=".csv,text/csv" onChange={importCsv} />
      <h2>Existing groups</h2>
      <ul>
        {cohorts.map(c => (
          <li key={c.id}>
            {c.name} {c.expiresAt && `(expires ${c.expiresAt})`}
          </li>
        ))}
      </ul>
      <h2>Students</h2>
      <table border={1} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Username</th>
            <th>Age</th>
            <th>Email</th>
            <th>Group</th>
          </tr>
        </thead>
        <tbody>
          {students.map(st => (
            <tr key={st.studentId}>
              <td>{st.studentId}</td>
              <td>{st.name}</td>
              <td>{st.username}</td>
              <td>{st.age}</td>
              <td>{st.email}</td>
              <td>{st.group}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
