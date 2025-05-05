'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Import createUserWithEmailAndPassword
import { createUserWithEmailAndPassword } from 'firebase/auth'; 
import { auth } from '@/lib/firebase'; // Adjust path if necessary
import { useAuth } from '@/context/AuthContext'; // Adjust path if necessary

const SignUpPage: React.FC = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Redirect if user is already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/'); // Redirect to home page or dashboard
    }
  }, [user, loading, router]);

  // Handler for email/password sign-up
  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    // Basic password validation (optional but recommended)
    if (password.length < 6) {
        setError("Password should be at least 6 characters long.");
        return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Sign-up successful, Firebase automatically signs the user in.
      // Redirect is handled by the useEffect hook.
      router.push('/'); // Or redirect immediately
    } catch (error: any) {
      console.error("Error signing up: ", error);
      setError(error.message || 'Failed to sign up. Please try again.');
      // Handle specific errors like email-already-in-use
    }
  };

  // Don't render the sign-up form if loading or already logged in
  if (loading || user) {
    return <div>Loading...</div>; // Or a spinner/placeholder
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>
        <h1>Sign Up</h1>
        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            required
            style={{ padding: '10px' }}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min. 6 characters)"
            required
            style={{ padding: '10px' }}
          />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button 
            type="submit"
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
          >
            Sign Up
          </button>
        </form>
        {/* Optional: Add link back to sign-in page */}
        <p style={{marginTop: '10px', textAlign: 'center'}}>Already have an account? <a href="/signin" style={{color: 'blue', textDecoration: 'underline'}}>Sign In</a></p>
      </div>
    </div>
  );
};

export default SignUpPage; 