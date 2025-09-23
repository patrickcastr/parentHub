"use client";

import { useEffect, useState } from 'react';
import { logout } from '@/lib/api/auth';

export default function Nav() {
  const [role, setRole] = useState<'TEACHER' | 'STUDENT' | null>(null);
  useEffect(() => {
    const r = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
    if (r === 'TEACHER' || r === 'STUDENT') {
      setRole(r as 'TEACHER' | 'STUDENT');
    }
  }, []);
  return (
    <nav>
      {role === null && (
        <>
          <a href="/">Home</a>
          <a href="/teachers">Teachers</a>
          <a href="/students">Students</a>
          <a href="/login">Sign in</a>
          <a href="/register">Register</a>
        </>
      )}
      {role === 'TEACHER' && (
        <>
          <a href="/teachers">Teachers</a>
          <a
            href="#"
            onClick={() => {
              logout().then(() => {
                localStorage.removeItem('role');
                window.location.href = '/';
              });
            }}
          >
            Sign out
          </a>
        </>
      )}
      {role === 'STUDENT' && (
        <>
          <a href="/students">Students</a>
          <a
            href="#"
            onClick={() => {
              logout().then(() => {
                localStorage.removeItem('role');
                window.location.href = '/';
              });
            }}
          >
            Sign out
          </a>
        </>
      )}
    </nav>
  );
}
