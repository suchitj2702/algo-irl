'use client';

import { ToastProvider } from '../../components/ui';

export default function ToastTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      {children}
    </ToastProvider>
  );
} 