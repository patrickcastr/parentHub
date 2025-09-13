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

export default function HomePage() {
  // Placeholder simple landing page replacing legacy admin dashboard

  return <div className="p-6 space-y-4">
    <h1 className="text-2xl font-bold">Parent Hub</h1>
    <p className="text-slate-600 max-w-prose">Welcome. Teachers can manage groups and students after signing in. Students can view their assigned group and files.</p>
    <div className="space-x-3">
      <a href="/login" className="underline text-blue-600">Sign in</a>
      <a href="/students" className="underline text-blue-600">Student Portal</a>
    </div>
  </div>;
}
