import { DrawerProvider } from '@/lib/drawer-context';
import AppLayout from '@/components/AppLayout';
import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DataMap - 元数据治理平台',
  description: 'Enterprise Metadata Governance Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <DrawerProvider>
          <AppLayout>
            {children}
          </AppLayout>
        </DrawerProvider>
      </body>
    </html>
  );
}
