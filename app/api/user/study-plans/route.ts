import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import {
  StudyPlanCreatePayloadSchema,
} from '@algo-irl/lib/user/studyPlanValidation';
import { serializeStudyPlanDoc } from '@algo-irl/lib/user/studyPlanSerialization';

function parsePaginationParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(
    Math.max(parseInt(params.get('limit') ?? '10', 10) || 10, 1),
    50
  );

  const cursor = params.get('cursor');
  return { limit, cursor };
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const db = adminDb();
    const { limit, cursor } = parsePaginationParams(request);

    const plansCollection = db.collection('userStudyPlans').doc(user.uid).collection('plans');
    let query = plansCollection.orderBy('createdAt', 'desc').limit(limit);

    if (cursor) {
      const cursorDoc = await plansCollection.doc(cursor).get();
      if (!cursorDoc.exists) {
        return NextResponse.json(
          { error: 'Invalid pagination cursor' },
          { status: 400 }
        );
      }
      query = query.startAfter(cursorDoc);
    }

    const snapshot = await query.get();
    const items = snapshot.docs.map(serializeStudyPlanDoc);
    const nextCursor = snapshot.size === limit ? snapshot.docs[snapshot.docs.length - 1]?.id ?? null : null;

    return NextResponse.json({
      data: items,
      nextCursor,
    });
  } catch (error) {
    console.error('[API][StudyPlans][GET] Failed to fetch study plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch study plans' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const payload = await request.json();
    const validated = StudyPlanCreatePayloadSchema.safeParse(payload);

    if (!validated.success) {
      return NextResponse.json(
        {
          error: 'Invalid study plan payload',
          details: validated.error.flatten(),
        },
        { status: 400 }
      );
    }

    const db = adminDb();
    const now = Timestamp.now();
    const plansCollection = db.collection('userStudyPlans').doc(user.uid).collection('plans');
    const docRef = plansCollection.doc();

    const responsePayload = validated.data.response;
    const totalProblems = responsePayload.studyPlan.totalProblems;

    await docRef.set({
      id: docRef.id,
      config: validated.data.config,
      response: responsePayload,
      createdAt: now,
      updatedAt: now,
      progress: {
        status: 'not_started',
        completedProblems: 0,
        totalProblems,
        currentDay: 0,
        lastUpdatedAt: now,
        problemProgress: {},
      },
    });

    const createdDoc = await docRef.get();

    return NextResponse.json(serializeStudyPlanDoc(createdDoc), { status: 201 });
  } catch (error) {
    console.error('[API][StudyPlans][POST] Failed to create study plan:', error);
    return NextResponse.json(
      { error: 'Failed to create study plan' },
      { status: 500 }
    );
  }
}
