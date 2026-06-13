import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'ประกันภัยไร้คอม',
  description: 'ระบบเสนอเบี้ยประกันภัยรถยนต์สำหรับลูกค้าและแอดมิน'
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
