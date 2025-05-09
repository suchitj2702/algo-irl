'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/authentication/AuthContext';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';

export default function VerifyEmailPage() {
  const { user, loading, isEmailVerified, reloadUser, signOut } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    // If user is verified, redirect them away from this page (e.g., to home)
    if (!loading && isEmailVerified) {
      router.push('/');
    }
    // If there's no user or loading is done and email is verified, redirecting might happen
    // If loading is done and there's no user, they shouldn't be here - redirect to signin
    if (!loading && !user) {
      router.push('authentication/signin');
    }

  }, [user, loading, isEmailVerified, router]);

  const handleResendVerification = async () => {
    if (!user) {
      setError("No user logged in.");
      return;
    }
    setResendLoading(true);
    setError(null);
    setMessage(null);
    try {
      await sendEmailVerification(user);
      setMessage("Verification email sent again. Please check your inbox (and spam folder).");
    } catch (err: any) {
      console.error("Resend verification error:", err);
      setError("Failed to resend verification email. Please try again later.");
    } finally {
      setResendLoading(false);
    }
  };

  const checkVerificationStatus = async () => {
    setMessage("Checking verification status...");
    setError(null);
    try {
      await reloadUser(); // reloadUser updates isEmailVerified in context
      // The useEffect hook will handle redirection if verified
       const freshUser = auth.currentUser // We need auth here to get the fresh user state after reload
       if (freshUser?.emailVerified) { // Check the potentially updated user object
         setMessage("Email verified successfully! Redirecting...");
         // Redirect is handled by useEffect
       } else {
         setMessage("Email not verified yet. Please check your email or resend.");
       }
    } catch (error) {
       console.error("Error reloading user:", error);
       setError("Failed to check verification status. Please try again.")
    }

  };

  if (loading) {
    return <div>Loading...</div>; // Or a spinner
  }

  if (!user) {
    // This case should ideally be handled by the redirect in useEffect,
    // but return null or a message as a fallback.
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-lg text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">Verify Your Email</h2>
        <p className="mb-6 text-gray-600">
          A verification link has been sent to <strong>{user.email}</strong>.
          Please check your inbox (and spam folder) and click the link to activate your account.
        </p>
        {message && <p className="text-blue-600 text-sm mb-4">{message}</p>}
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-6">
          <button
            onClick={checkVerificationStatus}
            className="bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            I've Verified My Email
          </button>
          <button
            onClick={handleResendVerification}
            disabled={resendLoading}
            className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {resendLoading ? 'Sending...' : 'Resend Verification Email'}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Incorrect email?{' '}
          <button onClick={signOut} className="text-indigo-600 hover:text-indigo-500 font-medium">
            Sign out and use a different account
          </button>
        </p>
      </div>
    </div>
  );
} 