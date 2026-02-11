import { NextRequest } from 'next/server';
import { requireUser } from '@algo-irl/lib/auth/verifyFirebaseToken';
import {
  syncRazorpayCustomer,
  createRazorpaySubscription,
} from '@algo-irl/lib/razorpay/razorpayClient';
import { isPaymentsEnabled, isUserInRollout } from '@algo-irl/lib/firebase/remoteConfig';
import { adminDb } from '@algo-irl/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { apiError, apiSuccess, toErrorMessage } from '@/lib/shared/apiResponse';

interface CreateSubscriptionRequest {
  planId: string;
  totalCount?: number;
  customerNotify?: 0 | 1;
  returnUrl?: string;
  metadata?: {
    source?: 'landing' | 'study-plan' | 'upgrade-modal';
    feature?: string;
    userId?: string;
    timestamp?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireUser(request);

    const paymentsEnabled = await isPaymentsEnabled();
    if (!paymentsEnabled) {
      return apiError(503, 'Payments are currently disabled. Please try again later.');
    }

    const userInRollout = await isUserInRollout(user.uid, user.email);
    if (!userInRollout) {
      return apiError(403, 'Payments are not available for your account yet. Please check back later.');
    }

    const body: CreateSubscriptionRequest = await request.json();
    const { planId, totalCount, customerNotify = 1 } = body;

    if (!planId) {
      return apiError(400, 'planId is required');
    }

    const appUrlString = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrlString) {
      console.error('[API][Billing][CreateSubscription] Missing NEXT_PUBLIC_APP_URL environment variable');
      return apiError(500, 'Payment configuration is invalid. Please contact support.');
    }

    const appUrl = new URL(appUrlString);

    if (body.returnUrl) {
      try {
        const candidateUrl = new URL(body.returnUrl, appUrl);
        if (candidateUrl.origin !== appUrl.origin) {
          return apiError(400, 'Invalid return URL');
        }
      } catch {
        return apiError(400, 'Invalid return URL format');
      }
    }

    const validPlanId = process.env.RAZORPAY_PLAN_MONTHLY_INR;
    if (!validPlanId || planId !== validPlanId) {
      return apiError(400, 'Invalid planId');
    }

    const db = adminDb();

    console.log('Subscription creation attempt:', {
      userId: user.uid,
      planId,
      source: body.metadata?.source,
      timestamp: new Date().toISOString(),
    });

    const recentAttempts = await db
      .collection('payment_intents')
      .where('userId', '==', user.uid)
      .where('createdAt', '>', new Date(Date.now() - 60_000))
      .get();

    if (recentAttempts.size >= 3) {
      return apiError(429, 'Too many payment attempts. Please wait a minute.');
    }

    const razorpayCustomerId = await syncRazorpayCustomer({
      uid: user.uid,
      email: user.email,
    });

    const subscriptionNotes = {
      firebase_uid: user.uid,
      user_email: user.email || '',
      return_url: body.returnUrl || '/my-study-plans',
      source: body.metadata?.source || 'unknown',
      feature: body.metadata?.feature,
      created_at: new Date().toISOString(),
    };

    const subscription = await createRazorpaySubscription({
      customerId: razorpayCustomerId,
      planId,
      totalCount: totalCount ?? 120,
      customerNotify,
      notes: subscriptionNotes,
      notifyInfo: user.email
        ? {
            notify_email: user.email,
          }
        : undefined,
    });

    await db
      .collection('payment_intents')
      .doc(subscription.id)
      .set({
        subscriptionId: subscription.id,
        userId: user.uid,
        planId,
        status: 'pending',
        returnUrl: body.returnUrl ?? null,
        metadata: body.metadata ?? null,
        createdAt: FieldValue.serverTimestamp(),
        shortUrl: subscription.short_url ?? null,
      });

    return apiSuccess({
      subscriptionId: subscription.id,
      status: subscription.status,
      shortUrl: subscription.short_url,
      currentStart: subscription.current_start,
      currentEnd: subscription.current_end,
      planId: subscription.plan_id,
      returnUrl: body.returnUrl,
      callbackUrl: new URL(
        `/payment-status?subscription_id=${subscription.id}`,
        appUrl
      ).toString(),
    }, { status: 201 });

  } catch (error) {
    console.error('[API][Billing][CreateSubscription] Error:', error);
    return apiError(500, toErrorMessage(error));
  }
}
