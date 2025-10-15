import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import {
  StudyPlanProgressSchema,
} from '@algo-irl/lib/user/studyPlanValidation';
import { serializeStudyPlanDoc } from '@algo-irl/lib/user/studyPlanSerialization';

export const runtime = 'nodejs';

function extractPlanId(request: NextRequest): string | null {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const planId = segments.at(-1);
  return planId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const planId = extractPlanId(request);

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const db = adminDb();
    const planRef = db.collection('userStudyPlans').doc(user.uid).collection('plans').doc(planId);
    const doc = await planRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Study plan not found' }, { status: 404 });
    }

    return NextResponse.json(serializeStudyPlanDoc(doc));
  } catch (error) {
    console.error('[API][StudyPlans][GET] Failed to fetch study plan:', error);
    return NextResponse.json({ error: 'Failed to fetch study plan' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const planId = extractPlanId(request);

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const payload = await request.json();

    const db = adminDb();
    const planRef = db.collection('userStudyPlans').doc(user.uid).collection('plans').doc(planId);

    // Get current document
    const currentDoc = await planRef.get();
    if (!currentDoc.exists) {
      return NextResponse.json({ error: 'Study plan not found' }, { status: 404 });
    }

    // Handle problemProgress updates
    if (payload.problemProgress) {
      const currentData = currentDoc.data();
      const currentProgress = currentData?.progress || {};
      const currentProblemProgress = currentProgress.problemProgress || {};

      // Deep merge problem progress - preserve existing problemDetails and codeDetails
      Object.keys(payload.problemProgress).forEach(problemId => {
        const newProgress = payload.problemProgress[problemId];
        const existingProgress = currentProblemProgress[problemId] || {};

        // Merge with existing, new values override old ones
        currentProblemProgress[problemId] = {
          ...existingProgress,
          ...newProgress,
          // Preserve problemDetails if not provided in update
          problemDetails: newProgress.problemDetails || existingProgress.problemDetails,
          // Preserve codeDetails if not provided in update
          codeDetails: newProgress.codeDetails || existingProgress.codeDetails
        };

        // Convert string timestamp to Firestore Timestamp
        if (currentProblemProgress[problemId].lastWorkedAt &&
            typeof currentProblemProgress[problemId].lastWorkedAt === 'string') {
          currentProblemProgress[problemId].lastWorkedAt =
            Timestamp.fromDate(new Date(currentProblemProgress[problemId].lastWorkedAt as string));
        }
      });

      // Auto-calculate completedProblems count
      const completedCount = Object.values(currentProblemProgress).filter(
        (p) => {
          const progress = p as Record<string, unknown> | undefined;
          return progress && progress.status === 'solved';
        }
      ).length;

      // Auto-update status based on completion
      const totalProblems = currentProgress.totalProblems || 0;
      let status = currentProgress.status || 'not_started';

      if (completedCount > 0 && completedCount < totalProblems) {
        status = 'in_progress';
      } else if (completedCount === totalProblems && totalProblems > 0) {
        status = 'completed';
      }

      // Update document
      await planRef.update({
        'progress.problemProgress': currentProblemProgress,
        'progress.completedProblems': completedCount,
        'progress.status': status,
        'progress.lastUpdatedAt': Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      const updatedDoc = await planRef.get();
      return NextResponse.json(serializeStudyPlanDoc(updatedDoc));
    }

    // Handle regular progress updates (non-problemProgress)
    const parsed = StudyPlanProgressSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid progress payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (parsed.data.status) updateData['progress.status'] = parsed.data.status;
    if (parsed.data.completedProblems !== undefined) updateData['progress.completedProblems'] = parsed.data.completedProblems;
    if (parsed.data.totalProblems !== undefined) updateData['progress.totalProblems'] = parsed.data.totalProblems;
    if (parsed.data.currentDay !== undefined) updateData['progress.currentDay'] = parsed.data.currentDay;
    if (parsed.data.note) updateData['progress.note'] = parsed.data.note;
    if (parsed.data.lastUpdatedAt) updateData['progress.lastUpdatedAt'] = Timestamp.fromDate(new Date(parsed.data.lastUpdatedAt));

    updateData.updatedAt = Timestamp.now();

    await planRef.update(updateData);

    const updatedDoc = await planRef.get();
    return NextResponse.json(serializeStudyPlanDoc(updatedDoc));
  } catch (error) {
    console.error('[API][StudyPlans][PATCH] Failed to update study plan:', error);
    return NextResponse.json({ error: 'Failed to update study plan' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const planId = extractPlanId(request);

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const db = adminDb();
    const planRef = db.collection('userStudyPlans').doc(user.uid).collection('plans').doc(planId);
    const planSnapshot = await planRef.get();

    if (!planSnapshot.exists) {
      return NextResponse.json({ error: 'Study plan not found' }, { status: 404 });
    }

    // Delete the study plan document (progress is now embedded, no subcollections to clean up)
    await planRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API][StudyPlans][DELETE] Failed to delete study plan:', error);
    return NextResponse.json(
      { error: 'Failed to delete study plan' },
      { status: 500 }
    );
  }
}
