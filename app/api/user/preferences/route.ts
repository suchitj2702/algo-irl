import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { UserPreferencesSchema, UserPreferencesPayload } from '@algo-irl/lib/user/preferencesValidation';

interface PreferencesResponse {
  preferences: UserPreferencesPayload;
  updatedAt: string | null;
}

function toIso(timestamp?: Timestamp | null): string | null {
  return timestamp ? timestamp.toDate().toISOString() : null;
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const db = adminDb();
    const docRef = db.collection('users').doc(user.uid).collection('preferences').doc('ui');
    const snapshot = await docRef.get();

    if (!snapshot.exists) {
      return NextResponse.json<PreferencesResponse>({
        preferences: {},
        updatedAt: null,
      });
    }

    const data = snapshot.data();
    const { updatedAt, ...rest } = data ?? {};
    const parsed = UserPreferencesSchema.safeParse(rest);

    const preferences = parsed.success ? parsed.data : {};

    return NextResponse.json<PreferencesResponse>({
      preferences,
      updatedAt: toIso(updatedAt as Timestamp | undefined),
    });
  } catch (error) {
    console.error('[API][Preferences][GET] Failed to fetch preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const payload = await request.json();
    const parsed = UserPreferencesSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid preferences payload',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const db = adminDb();
    const now = Timestamp.now();
    const docRef = db.collection('users').doc(user.uid).collection('preferences').doc('ui');

    await docRef.set(
      {
        ...parsed.data,
        updatedAt: now,
      },
      { merge: true }
    );

    return NextResponse.json<PreferencesResponse>({
      preferences: parsed.data,
      updatedAt: now.toDate().toISOString(),
    });
  } catch (error) {
    console.error('[API][Preferences][PUT] Failed to update preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
