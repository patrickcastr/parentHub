import './globals.css';
import Nav from '@/components/Nav';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Parent Hub',
  description: 'School Parent Portal'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
