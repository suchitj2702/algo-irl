import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    };

    return NextResponse.json({
      environment: process.env.NODE_ENV || 'development',
      firebaseConfig: firebaseConfig,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting Firebase config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get Firebase config' },
      { status: 500 }
    );
  }
} 