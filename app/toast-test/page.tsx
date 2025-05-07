'use client';

import { useState } from 'react';
import { Button, useToast } from '../../components/ui';

export default function ToastTestPage() {
  const { addToast } = useToast();
  const [counter, setCounter] = useState(0);

  const handleAddToast = (type: 'success' | 'error' | 'warning' | 'info') => {
    setCounter(prev => prev + 1);
    addToast(`Test ${type} toast #${counter + 1}`, type);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6">Toast Notification Test</h1>
        
        <p className="mb-6">
          Click the buttons below to test different types of toast notifications.
          They should automatically disappear after 5 seconds or when you click the close button.
        </p>
        
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="success" 
            onClick={() => handleAddToast('success')}
          >
            Show Success Toast
          </Button>
          
          <Button 
            variant="danger" 
            onClick={() => handleAddToast('error')}
          >
            Show Error Toast
          </Button>
          
          <Button 
            variant="warning" 
            onClick={() => handleAddToast('warning')}
          >
            Show Warning Toast
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={() => handleAddToast('info')}
          >
            Show Info Toast
          </Button>

          <Button 
            variant="primary" 
            onClick={() => {
              // Add multiple toasts to test stacking
              handleAddToast('success');
              setTimeout(() => handleAddToast('error'), 300);
              setTimeout(() => handleAddToast('warning'), 600);
              setTimeout(() => handleAddToast('info'), 900);
            }}
          >
            Show Multiple Toasts
          </Button>
          
          <Button 
            variant="secondary" 
            onClick={() => {
              addToast('Custom duration toast (2 seconds)', 'info', 2000);
            }}
          >
            Short Duration (2s)
          </Button>
        </div>
      </div>
    </div>
  );
} 