import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import {
  StudyPlanProgressSchema,
} from '@algo-irl/lib/user/studyPlanValidation';
import { serializeStudyPlanDoc } from '@algo-irl/lib/user/studyPlanSerialization';
import { apiError, apiSuccess } from '@/lib/shared/apiResponse';

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
      return apiError(400, 'planId is required');
    }

    const db = adminDb();
    const planRef = db.collection('userStudyPlans').doc(user.uid).collection('plans').doc(planId);
    const doc = await planRef.get();

    if (!doc.exists) {
      return apiError(404, 'Study plan not found');
    }

    return apiSuccess(serializeStudyPlanDoc(doc));
  } catch (error) {
    console.error('[API][StudyPlans][GET] Failed to fetch study plan:', error);
    return apiError(500, 'Failed to fetch study plan');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const planId = extractPlanId(request);

    if (!planId) {
      return apiError(400, 'planId is required');
    }

    const payload = await request.json();

    const db = adminDb();
    const planRef = db.collection('userStudyPlans').doc(user.uid).collection('plans').doc(planId);

    // Get current document
    const currentDoc = await planRef.get();
    if (!currentDoc.exists) {
      return apiError(404, 'Study plan not found');
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
          problemDetails: newProgress.problemDetails || existingProgress.problemDetails,
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
      return apiSuccess(serializeStudyPlanDoc(updatedDoc));
    }

    // Handle regular progress updates (non-problemProgress)
    const parsed = StudyPlanProgressSchema.safeParse(payload);
    if (!parsed.success) {
      return apiError(400, 'Invalid progress payload');
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
    return apiSuccess(serializeStudyPlanDoc(updatedDoc));
  } catch (error) {
    console.error('[API][StudyPlans][PATCH] Failed to update study plan:', error);
    return apiError(500, 'Failed to update study plan');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const planId = extractPlanId(request);

    if (!planId) {
      return apiError(400, 'planId is required');
    }

    const db = adminDb();
    const planRef = db.collection('userStudyPlans').doc(user.uid).collection('plans').doc(planId);
    const planSnapshot = await planRef.get();

    if (!planSnapshot.exists) {
      return apiError(404, 'Study plan not found');
    }

    await planRef.delete();

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('[API][StudyPlans][DELETE] Failed to delete study plan:', error);
    return apiError(500, 'Failed to delete study plan');
  }
}
