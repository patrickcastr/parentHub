import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function AppNav() {
  return (
    <nav className="flex gap-2 p-4 border-b bg-background">
      <Button asChild variant="outline"><Link href="/">Home</Link></Button>
      <Button asChild variant="outline"><Link href="/teachers/admin">Teachers</Link></Button>
      <Button asChild variant="outline"><Link href="/students">Students</Link></Button>
      <Button asChild variant="outline"><Link href="/login">Sign In</Link></Button>
      <Button asChild variant="outline"><Link href="/register">Register</Link></Button>
    </nav>
  );
}
