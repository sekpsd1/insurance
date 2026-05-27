import type { ReactNode } from 'react';

export default function LineAppLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <main className="min-h-screen bg-white">
      {children}
    </main>
  );
}
