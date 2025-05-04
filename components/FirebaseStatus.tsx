import React from 'react';
import { app } from '@/lib/firebase'; // Assuming your path alias is set up or adjust the path accordingly

const FirebaseStatus: React.FC = () => {
  const isInitialized = !!app; // Check if the Firebase app instance exists

  return (
    <div>
      {isInitialized ? (
        <p style={{ color: 'green' }}>Firebase Initialized Successfully!</p>
      ) : (
        <p style={{ color: 'red' }}>Firebase NOT Initialized.</p>
      )}
    </div>
  );
};

export default FirebaseStatus; 