// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';

// Minimal example (legacy Next.js layer) — if still used, protect /teachers & /students
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get('ph.sid');
  if ((pathname.startsWith('/teachers') || pathname.startsWith('/students')) && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/teachers/:path*', '/students/:path*'] };