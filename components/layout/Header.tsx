'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/authentication/AuthContext'; // Adjust path if necessary
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase'; // Adjust path if necessary

const Header: React.FC = () => {
  const { user } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // User signed out, AuthContext will update
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <header className="bg-white shadow-md h-16 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center">
        {/* Placeholder for a logo or app name */}
        <Link href="/" className="text-xl font-semibold text-gray-800">
          AlgoIRL
        </Link>
        {/* Potential space for a mobile menu button */}
      </div>
      <nav className="flex items-center space-x-4">
        {user ? (
          <>
            {/* Display user info if needed */}
            {/* <span className="text-gray-600 hidden md:block">Welcome, {user.displayName || user.email}</span> */}
            <button
              onClick={handleSignOut}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded text-sm"
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/authentication/signin" className="text-gray-600 hover:text-gray-800 text-sm font-medium">
              Sign In
            </Link>
            <Link href="/authentication/signup" className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-sm">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header; 