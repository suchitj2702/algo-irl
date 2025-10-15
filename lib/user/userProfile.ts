import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * User Profile Structure
 * Matches the implementation plan schema
 */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  tier: 'free' | 'premium';
  razorpayCustomerId: string | null;
  metadata: {
    totalStudyPlans: number;
    totalProblemsCompleted: number;
  };
}

/**
 * Create or update user profile on first login/signup
 */
export async function createOrUpdateUserProfile(params: {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<void> {
  const { uid, email, displayName = null, photoURL = null } = params;
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    // Create new user profile
    await userRef.set({
      uid,
      email,
      displayName,
      photoURL,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
      tier: 'free', // Default to free tier
      razorpayCustomerId: null,
      metadata: {
        totalStudyPlans: 0,
        totalProblemsCompleted: 0,
      },
    });
    console.log(`[UserProfile] Created profile for user: ${uid}`);
  } else {
    // Update last login time
    await userRef.update({
      lastLoginAt: Timestamp.now(),
      // Optionally update display name and photo if provided
      ...(displayName !== null && { displayName }),
      ...(photoURL !== null && { photoURL }),
    });
    console.log(`[UserProfile] Updated last login for user: ${uid}`);
  }
}

/**
 * Update last login timestamp
 */
export async function updateLastLogin(uid: string): Promise<void> {
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  await userRef.update({
    lastLoginAt: Timestamp.now(),
  });
}

/**
 * Increment study plan count
 * Call this when a user creates a new study plan
 */
export async function incrementStudyPlanCount(uid: string): Promise<void> {
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  await userRef.update({
    'metadata.totalStudyPlans': FieldValue.increment(1),
  });

  console.log(`[UserProfile] Incremented study plan count for user: ${uid}`);
}

/**
 * Increment problems completed count
 * Call this when a user completes a problem
 */
export async function incrementProblemsCompleted(uid: string): Promise<void> {
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);

  await userRef.update({
    'metadata.totalProblemsCompleted': FieldValue.increment(1),
  });

  console.log(`[UserProfile] Incremented problems completed for user: ${uid}`);
}

/**
 * Get user profile
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = adminDb();
  const userRef = db.collection('users').doc(uid);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    return null;
  }

  return userDoc.data() as UserProfile;
}

/**
 * Check if user has premium tier
 */
export async function hasActiveSubscription(uid: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  return profile?.tier === 'premium';
}
