import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import type { DocumentData } from 'firebase-admin/firestore';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { apiError, apiSuccess } from '@/lib/shared/apiResponse';

const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'past_due'];

// Single plan display name
const PLAN_DISPLAY_NAME = 'Monthly Subscription - INR';

type SubscriptionDoc = {
  id: string;
  data: DocumentData;
};

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value > 10_000_000_000 ? new Date(value) : new Date(value * 1000);
  }

  return null;
}

function calculateDaysRemaining(date: Date | null): number | null {
  if (!date) return null;
  const diffMs = date.getTime() - Date.now();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getPlanDisplayName(planId: string | undefined | null): string {
  return planId ? PLAN_DISPLAY_NAME : 'Comprehensive Plan';
}

async function getActiveSubscription(userId: string): Promise<SubscriptionDoc | null> {
  const db = adminDb();
  const snapshot = await db
    .collection('customers')
    .doc(userId)
    .collection('subscriptions')
    .where('statusMapped', 'in', ACTIVE_SUBSCRIPTION_STATUSES)
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { id: doc.id, data: doc.data() };
}

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireUser(request);
    const action = request.nextUrl.searchParams.get('action');

    if (!action) {
      return apiError(400, 'action query parameter is required');
    }

    switch (action) {
      case 'details':
        return await getSubscriptionDetails(user.uid);
      case 'history': {
        const limitParam = request.nextUrl.searchParams.get('limit');
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 10;
        const historyLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : 10;
        return await getPaymentHistory(user.uid, historyLimit);
      }
      case 'upcoming':
        return await getUpcomingInvoice(user.uid);
      default:
        return apiError(400, 'Invalid action');
    }
  } catch (error) {
    console.error('[API][Billing][ManageSubscription] Error:', error);
    return apiError(500, 'Failed to manage subscription');
  }
}

async function getSubscriptionDetails(userId: string): Promise<NextResponse> {
  const subscriptionDoc = await getActiveSubscription(userId);

  if (!subscriptionDoc) {
    return apiSuccess({ hasSubscription: false, status: 'none' });
  }

  const subscription = subscriptionDoc.data;
  const currentPeriodEndDate = toDate(subscription.currentPeriodEnd);
  const daysRemaining = calculateDaysRemaining(currentPeriodEndDate);

  return apiSuccess({
    hasSubscription: true,
    subscription: {
      id: subscriptionDoc.id,
      status: subscription.statusMapped ?? subscription.status ?? null,
      planId: subscription.planId ?? null,
      planName: getPlanDisplayName(subscription.planId),
      currentPeriodStart: toDate(subscription.currentPeriodStart),
      currentPeriodEnd: currentPeriodEndDate,
      cancelAt: toDate(subscription.cancelAt),
      daysRemaining,
      isExpiring: daysRemaining !== null && daysRemaining <= 7,
      amount: subscription.data?.plan?.amount ?? 79_900,
      currency: subscription.data?.plan?.currency ?? 'INR',
    },
  });
}

async function getPaymentHistory(userId: string, limit = 10): Promise<NextResponse> {
  const db = adminDb();

  const snapshot = await db
    .collection('customers')
    .doc(userId)
    .collection('payments')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();

  const payments = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      amount: data.amount ?? null,
      currency: data.currency ?? null,
      status: data.status ?? null,
      method: data.method ?? null,
      createdAt: data.created_at ? new Date(data.created_at * 1000) : null,
      subscriptionId: data.subscription_id ?? null,
    };
  });

  return apiSuccess({ payments });
}

async function getUpcomingInvoice(userId: string): Promise<NextResponse> {
  const subscriptionDoc = await getActiveSubscription(userId);

  if (!subscriptionDoc) {
    return apiSuccess({ upcoming: null });
  }

  const subscription = subscriptionDoc.data;

  if ((subscription.statusMapped ?? subscription.status) !== 'active') {
    return apiSuccess({ upcoming: null });
  }

  const nextBillingDate = toDate(subscription.currentPeriodEnd);

  return apiSuccess({
    upcoming: {
      amount: subscription.data?.plan?.amount ?? 79_900,
      currency: subscription.data?.plan?.currency ?? 'INR',
      dueDate: nextBillingDate,
      planName: getPlanDisplayName(subscription.planId),
    },
  });
}
