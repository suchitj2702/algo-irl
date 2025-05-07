'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import Toast, { ToastType } from './Toast';

// Define the toast item type
export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  createdAt: number; // Timestamp when created
}

// Define the toast context type
interface ToastContextType {
  addToast: (message: string, type: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

// Create the toast context
const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Custom hook to use the toast context
export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Maximum age for a toast before forced cleanup (15 seconds)
const MAX_TOAST_AGE = 15000;

// Toast provider component
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Add a toast
  const addToast = (message: string, type: ToastType, duration?: number) => {
    const id = Math.random().toString(36).substring(2, 9);
    console.log('Adding toast:', id);
    setToasts(prev => [...prev, { 
      id, 
      message, 
      type, 
      duration,
      createdAt: Date.now() 
    }]);
  };

  // Remove a toast
  const removeToast = (id: string) => {
    console.log('Removing toast:', id);
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Cleanup stale toasts
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts(currentToasts => 
        currentToasts.filter(toast => {
          const age = now - toast.createdAt;
          if (age > MAX_TOAST_AGE) {
            console.log('Cleaning up stale toast:', toast.id, 'Age:', age);
            return false;
          }
          return true;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Log current toasts for debugging
  useEffect(() => {
    console.log('Current toasts:', toasts);
  }, [toasts]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// Toast container component
export default function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed top-0 right-0 p-4 w-full md:max-w-sm z-50 flex flex-col items-end gap-2">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={removeToast}
        />
      ))}
    </div>
  );
} 