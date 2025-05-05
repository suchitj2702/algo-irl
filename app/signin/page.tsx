'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase'; // Adjust path if necessary
import { useAuth } from '@/context/AuthContext'; // Adjust path if necessary

const SignInPage: React.FC = () => {
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

  // Updated handler for email/password sign-in
  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission
    setError(null); // Clear previous errors
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Authentication successful, redirect is handled by the useEffect hook
      router.push('/'); // Or redirect immediately after sign-in
    } catch (error: any) { // Catch specific Firebase errors if needed
      console.error("Error signing in: ", error);
      setError(error.message || 'Failed to sign in. Please check your credentials.');
      // Handle sign-in errors (e.g., show a message to the user)
    }
  };

  // Don't render the sign-in form if loading or already logged in
  if (loading || user) {
    return <div>Loading...</div>; // Or a spinner/placeholder
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div>
        <h1>Sign In</h1>
        <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
            placeholder="Password"
            required
            style={{ padding: '10px' }}
          />
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button 
            type="submit"
            style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
          >
            Sign In
          </button>
        </form>
        {/* Optional: Add link to sign-up page */}
        {/* <p>Don't have an account? <a href="/signup">Sign Up</a></p> */}
        <p style={{marginTop: '10px', textAlign: 'center'}}>Don't have an account? <a href="/signup" style={{color: 'blue', textDecoration: 'underline'}}>Sign Up</a></p>
      </div>
    </div>
  );
};

export default SignInPage; 