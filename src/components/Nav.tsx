"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Nav() {
  const [role, setRole] = useState<'teacher' | 'student' | null>(null);
  useEffect(() => {
    const r = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    if (r === 'teacher' || r === 'student') {
      setRole(r);
    }
  }, []);
  return (
    <nav>
      {role === null && (
        <>
          <Link href="/">Home</Link>
          <Link href="/teachers">Teachers</Link>
          <Link href="/students">Students</Link>
          <Link href="/login">Sign in</Link>
          <Link href="/register">Register</Link>
        </>
      )}
      {role === 'teacher' && (
        <>
          <Link href="/admin">Admin</Link>
          <Link
            href="#"
            onClick={() => {
              fetch('/api/auth/signout').then(() => {
                localStorage.removeItem('role');
                window.location.href = '/';
              });
            }}
          >
            Sign out
          </Link>
        </>
      )}
      {role === 'student' && (
        <>
          <Link href="/portal">Group</Link>
          <Link
            href="#"
            onClick={() => {
              fetch('/api/auth/signout').then(() => {
                localStorage.removeItem('role');
                window.location.href = '/';
              });
            }}
          >
            Sign out
          </Link>
        </>
      )}
    </nav>
  );
}
