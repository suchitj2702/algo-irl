'use client';

import { ToastProvider } from '../../../components/ui';

export default function SubmissionExampleLayout({
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