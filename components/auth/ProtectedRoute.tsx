'use client';

import { useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireVerifiedEmail?: boolean; // Optional: Set to true to require email verification
}

export default function ProtectedRoute({ children, requireVerifiedEmail = false }: ProtectedRouteProps) {
  const { user, loading, isEmailVerified } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Don't redirect until loading is finished
    if (loading) return;

    // If no user, redirect to sign-in
    if (!user) {
      router.push('/signin');
      return; // Stop further checks
    }

    // If email verification is required and email is not verified, redirect (or show a prompt - redirecting for now)
    if (requireVerifiedEmail && !isEmailVerified) {
      // Consider redirecting to a specific "verify email" page instead
      // Or displaying a message within the current layout
      router.push('/verify-email'); // Redirect to a hypothetical verification prompt page
    }

    // Allow access if checks pass
  }, [user, loading, isEmailVerified, requireVerifiedEmail, router]);

  // While loading or if redirecting, show nothing or a loader
  if (loading || !user || (requireVerifiedEmail && !isEmailVerified)) {
    // Optionally return a loading spinner component here
    return null; // Or <LoadingSpinner />
  }

  // If authenticated (and verified if required), render the children
  return <>{children}</>;
} 