'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut, // Alias to avoid naming conflict
  sendPasswordResetEmail,
  sendEmailVerification,
  AuthError
} from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isEmailVerified: boolean | null;
  reloadUser: () => Promise<void>; // Function to reload user data
}

// Define default values matching the type
const defaultAuthContextValue: AuthContextType = {
  user: null,
  loading: true,
  signIn: async () => { throw new Error("signIn function not implemented"); },
  signUp: async () => { throw new Error("signUp function not implemented"); },
  signOut: async () => { throw new Error("signOut function not implemented"); },
  resetPassword: async () => { throw new Error("resetPassword function not implemented"); },
  isEmailVerified: null,
  reloadUser: async () => { throw new Error("reloadUser function not implemented"); },
};

const AuthContext = createContext<AuthContextType>(defaultAuthContextValue);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);

  // Function to reload user data (especially after email verification)
  const reloadUser = async () => {
    await auth.currentUser?.reload();
    const freshUser = auth.currentUser;
    setUser(freshUser);
    setIsEmailVerified(freshUser?.emailVerified ?? null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Ensure latest verification status is checked on initial load/change
        await currentUser.reload();
        setUser(auth.currentUser); // Update state with potentially reloaded user
        setIsEmailVerified(auth.currentUser?.emailVerified ?? null);
      } else {
        setIsEmailVerified(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Auth state change will handle setting user and loading
    } catch (error) {
      console.error("Sign in error", error);
      setLoading(false);
      throw error; // Re-throw error to be caught in the component
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      // Auth state change will handle setting user, but set loading false here
      // as the user isn't fully "ready" until verified.
      setLoading(false);
    } catch (error) {
      console.error("Sign up error", error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      // Auth state change will set user to null
    } catch (error) {
      console.error("Sign out error", error);
      setLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setLoading(false);
    } catch (error) {
      console.error("Password reset error", error);
      setLoading(false);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    isEmailVerified,
    reloadUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  return useContext(AuthContext);
}; 